/**
 * Sesión autorizada en SISMAP. Playwright se usa solo para el formulario de login;
 * las páginas y exportaciones se descargan con el contexto HTTP que comparte las cookies.
 * Nunca se intenta evadir CAPTCHA ni MFA.
 */
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { chromium, type APIRequestContext, type Browser, type BrowserContext, type Page } from 'playwright';

export class SismapAuthError extends Error {
  constructor(
    public readonly code: 'NO_CREDENTIALS' | 'LOGIN_FAILED' | 'BLOCKED_CAPTCHA' | 'BLOCKED_MFA' | 'LOGIN_EXPIRED',
    message: string,
  ) {
    super(message);
    this.name = 'SismapAuthError';
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} al pedir ${url}`);
    this.name = 'HttpError';
  }
}

export interface SismapSession {
  request: APIRequestContext;
  /** Descarga texto con la sesión; renueva el login una vez si SISMAP redirige al Login. */
  fetchText(url: string): Promise<string>;
  close(): Promise<void>;
}

const LOGIN_PATH_RE = /\/login(\?|$)/i;

function dataDir(): string {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.APP_DATA_DIR || './data');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function allowedHosts(): string[] {
  return (process.env.MAP_ALLOWED_HOSTS || 'www.sismap.gob.do').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

export function assertAllowedUrl(url: string): URL {
  const u = new URL(url);
  if (!allowedHosts().includes(u.hostname.toLowerCase())) {
    throw new Error(`Host no permitido: ${u.hostname}. Permitidos: ${allowedHosts().join(', ')}`);
  }
  return u;
}

async function looksLikeLoginPage(page: Page): Promise<{ login: boolean; captcha: boolean; mfa: boolean }> {
  return page
    .evaluate(() => {
      const visible = Array.from(document.querySelectorAll('input[type="password"]')).some((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const srcs = Array.from(document.querySelectorAll('iframe[src], script[src]')).map((e) => e.getAttribute('src') || '');
      const captcha = srcs.some((s) => /recaptcha|hcaptcha|turnstile|captcha/i.test(s)) || !!document.querySelector('.g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey]');
      const mfa = Array.from(document.querySelectorAll('input')).some((i) => /one-time-code|otp|2fa|mfa|totp|verificaci/i.test(`${i.getAttribute('autocomplete')} ${i.name} ${i.id}`));
      return { login: visible, captcha, mfa };
    })
    .catch(() => ({ login: false, captcha: false, mfa: false }));
}

/**
 * Rellena el formulario de login en `loginPageUrl` (la página a la que SISMAP redirige).
 * Si al llegar no hay formulario, la sesión ya es válida y no hace nada.
 */
async function loginWithForm(context: BrowserContext, loginPageUrl: string, statePath: string, log: (m: string) => void): Promise<void> {
  const username = process.env.MAP_USERNAME;
  const password = process.env.MAP_PASSWORD;
  if (!username || !password) throw new SismapAuthError('NO_CREDENTIALS', 'MAP_USERNAME y MAP_PASSWORD no están definidos.');

  const page = await context.newPage();
  try {
    log(`abriendo página de login: ${loginPageUrl.split('?')[0]}`);
    await page.goto(loginPageUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const probe = await looksLikeLoginPage(page);
    if (probe.captcha) throw new SismapAuthError('BLOCKED_CAPTCHA', 'SISMAP muestra un CAPTCHA; no se automatiza.');
    if (probe.mfa) throw new SismapAuthError('BLOCKED_MFA', 'SISMAP pide un segundo factor; no se automatiza.');
    if (!probe.login) {
      log('no apareció formulario de login; se conserva la sesión actual');
      return;
    }

    const user = page.getByLabel(/usuario|user|correo|email|c[eé]dula/i).first();
    const userFallback = page.locator('input[autocomplete="username"], input[type="email"], input[name*="user" i], input[name*="email" i], form:has(input[type="password"]) input[type="text"]').first();
    const userField = (await user.count()) && (await user.isVisible().catch(() => false)) ? user : userFallback;
    await userField.fill(username);
    await page.locator('input[type="password"]').first().fill(password);
    const submit = page.getByRole('button', { name: /iniciar|entrar|ingresar|acceder|login|log in|sign in/i }).first();
    const navigation = page.waitForLoadState('load', { timeout: 45_000 }).catch(() => undefined);
    if (await submit.count()) await submit.click();
    else await page.locator('input[type="password"]').first().press('Enter');
    await navigation;
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    const after = await looksLikeLoginPage(page);
    if (after.mfa) throw new SismapAuthError('BLOCKED_MFA', 'SISMAP pide un segundo factor tras el login; no se automatiza.');
    if (after.login && LOGIN_PATH_RE.test(new URL(page.url()).pathname)) {
      throw new SismapAuthError('LOGIN_FAILED', 'SISMAP rechazó las credenciales o cambió el formulario de login.');
    }
    await context.storageState({ path: statePath });
    try {
      chmodSync(statePath, 0o600);
    } catch {
      /* Windows */
    }
    log('sesión iniciada y guardada');
  } finally {
    await page.close();
  }
}

/** Abre una sesión reutilizando el storageState guardado; hace login solo cuando SISMAP lo exige. */
/** `loginUrl` opcional: si no se indica, se usa la página de login a la que SISMAP redirige. */
export async function openSismapSession(opts: { loginUrl?: string; log?: (m: string) => void }): Promise<SismapSession> {
  const log = opts.log ?? (() => undefined);
  const statePath = path.join(dataDir(), 'sismap-session.json');
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: existsSync(statePath) ? statePath : undefined, locale: 'es-DO' });
  let renewed = false;

  const rawGet = async (url: string) => {
    assertAllowedUrl(url);
    const res = await context.request.get(url, { maxRedirects: 0, timeout: 60_000 });
    const location = res.headers()['location'] ?? '';
    if (res.status() >= 300 && res.status() < 400 && LOGIN_PATH_RE.test(new URL(location, url).pathname)) {
      return { res, loginRequired: true, loginPage: new URL(location, url).toString() };
    }
    if (res.status() === 200 && LOGIN_PATH_RE.test(new URL(res.url()).pathname)) {
      return { res, loginRequired: true, loginPage: res.url() };
    }
    // SISMAP a veces sirve el formulario de login con 200 en la misma URL (p. ej. exportaciones).
    if (res.status() === 200 && /text\/html/i.test(res.headers()['content-type'] ?? '')) {
      const body = (await res.body()).toString('utf8');
      if (/type="password"/i.test(body) && /iniciar sesi/i.test(body)) {
        return { res, loginRequired: true, loginPage: url, body };
      }
      return { res, loginRequired: false, loginPage: '', body };
    }
    return { res, loginRequired: false, loginPage: '', body: undefined as string | undefined };
  };

  const session: SismapSession = {
    request: context.request,
    async fetchText(url) {
      let got = await rawGet(url);
      if (got.loginRequired) {
        if (renewed) throw new SismapAuthError('LOGIN_EXPIRED', 'La sesión de SISMAP expiró y la renovación no sirvió.');
        log('sesión ausente o expirada: iniciando sesión en SISMAP');
        await loginWithForm(context, opts.loginUrl || got.loginPage, statePath, log);
        renewed = true;
        got = await rawGet(url);
        if (got.loginRequired) throw new SismapAuthError('LOGIN_EXPIRED', 'SISMAP sigue pidiendo login tras autenticar.');
      }
      const { res } = got;
      if (got.body !== undefined && res.status() === 200) return got.body;
      if (res.status() >= 300 && res.status() < 400) {
        const target = new URL(res.headers()['location'] ?? '/', url).toString();
        const followed = await context.request.get(target, { maxRedirects: 2, timeout: 60_000 });
        if (followed.status() !== 200) throw new HttpError(followed.status(), target);
        return (await followed.body()).toString('utf8');
      }
      if (res.status() !== 200) throw new HttpError(res.status(), url);
      return (await res.body()).toString('utf8');
    },
    async close() {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
  return session;
}
