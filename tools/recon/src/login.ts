import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import type { ReconConfig } from './config.js';

export type AuthOutcome =
  | 'NOT_REQUIRED'
  | 'SESSION_REUSED'
  | 'LOGGED_IN'
  | 'LOGIN_FAILED'
  | 'BLOCKED_CAPTCHA'
  | 'BLOCKED_MFA'
  | 'NO_CREDENTIALS'
  | 'AUTO_LOGIN_DISABLED';

export interface AuthProbe {
  isLoginPage: boolean;
  reasons: string[];
  captcha: string[];
  mfa: string[];
}

export type Logger = (msg: string) => void;

const LOGIN_URL_RE = /(login|signin|sign-in|logon|auth|acceso|acceder|ingresar|iniciar|account\/log|sesion|session)/i;
const LOGIN_TEXT_RE = /(iniciar sesi[oó]n|inicie sesi[oó]n|ingresar al sistema|acceder al sistema|log ?in|sign in|usuario y contrase)/i;

/** Inspecciona la pagina actual buscando senales de formulario de login, CAPTCHA o MFA. Sin efectos. */
export async function probeLoginPage(page: Page): Promise<AuthProbe> {
  // Nota: sin funciones auxiliares con nombre dentro de evaluate (los transpiladores
  // pueden inyectar helpers como __name que no existen en el navegador).
  let evalError = '';
  const facts = await page
    .evaluate(() => {
      const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length;
      const bodyText = (document.body?.innerText || '').slice(0, 5000);
      const title = document.title || '';
      const iframeSrcs = Array.from(document.querySelectorAll('iframe')).map((f) => f.getAttribute('src') || '');
      const scriptSrcs = Array.from(document.querySelectorAll('script[src]')).map((s) => s.getAttribute('src') || '');
      const otpInputs = Array.from(document.querySelectorAll('input')).filter((i) => {
        const r = i.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return false;
        const a = `${i.getAttribute('autocomplete') || ''} ${i.name || ''} ${i.id || ''} ${i.getAttribute('placeholder') || ''}`;
        return /(one-time-code|otp|2fa|mfa|totp|verification|verificaci|c[oó]digo de seguridad)/i.test(a);
      }).length;
      const captchaMarkers = [...iframeSrcs, ...scriptSrcs]
        .filter((s) => /(recaptcha|hcaptcha|turnstile|challenges\.cloudflare|captcha)/i.test(s))
        .map((s) => s.slice(0, 80));
      const captchaDom = document.querySelector('.g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey], img[src*="captcha" i]') ? 1 : 0;
      return { passwordInputs, bodyText, title, otpInputs, captchaMarkers, captchaDom };
    })
    .catch((e: unknown) => {
      evalError = String((e as Error).message ?? e).slice(0, 200);
      return { passwordInputs: 0, bodyText: '', title: '', otpInputs: 0, captchaMarkers: [] as string[], captchaDom: 0 };
    });

  const reasons: string[] = [];
  if (evalError) reasons.push(`evaluate fallo: ${evalError}`);
  const url = page.url();
  if (facts.passwordInputs > 0) reasons.push('campo password visible');
  if (LOGIN_URL_RE.test(url)) reasons.push('URL parece de login');
  if (LOGIN_TEXT_RE.test(facts.title) || LOGIN_TEXT_RE.test(facts.bodyText)) reasons.push('texto de inicio de sesion');

  const captcha = [...facts.captchaMarkers];
  if (facts.captchaDom) captcha.push('elemento CAPTCHA en el DOM');
  const mfa: string[] = [];
  if (facts.otpInputs > 0) mfa.push(`${facts.otpInputs} campo(s) de codigo de verificacion`);
  if (/(c[oó]digo de verificaci[oó]n|autenticaci[oó]n de dos|two-factor|2fa|one-time)/i.test(facts.bodyText)) mfa.push('texto de verificacion en dos pasos');

  return { isLoginPage: facts.passwordInputs > 0 || (reasons.length >= 2), reasons, captcha, mfa };
}

export async function saveStorageState(context: BrowserContext, filePath: string): Promise<void> {
  mkdirSync(path.dirname(filePath), { recursive: true });
  await context.storageState({ path: filePath });
}

/**
 * Login automatico con usuario/password. Nunca intenta evadir CAPTCHA/MFA:
 * si los detecta, devuelve BLOCKED_* para documentar la limitacion.
 */
export async function attemptAutoLogin(
  page: Page,
  cfg: ReconConfig,
  log: Logger,
): Promise<{ outcome: AuthOutcome; details: string[] }> {
  const details: string[] = [];
  if (!cfg.autoLogin) return { outcome: 'AUTO_LOGIN_DISABLED', details: ['MAP_RECON_AUTO_LOGIN=false; use `npm run recon:login` para sesion manual'] };
  if (!cfg.username || !cfg.password) return { outcome: 'NO_CREDENTIALS', details: ['MAP_USERNAME/MAP_PASSWORD no definidos'] };

  const before = await probeLoginPage(page);
  if (before.captcha.length) return { outcome: 'BLOCKED_CAPTCHA', details: before.captcha };
  if (before.mfa.length) return { outcome: 'BLOCKED_MFA', details: before.mfa };

  const password = page.locator('input[type="password"]').first();
  if ((await password.count()) === 0) return { outcome: 'LOGIN_FAILED', details: ['no se encontro campo password'] };

  const userCandidates = [
    page.getByLabel(/usuario|user|correo|email|c[eé]dula|identificaci|login/i).first(),
    page.locator('input[autocomplete="username"], input[type="email"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[id*="user" i], input[id*="email" i]').first(),
    page.locator('form:has(input[type="password"]) input[type="text"]').first(),
  ];
  let filledUser = false;
  for (const cand of userCandidates) {
    try {
      if ((await cand.count()) > 0 && (await cand.isVisible())) {
        await cand.fill(cfg.username);
        filledUser = true;
        break;
      }
    } catch {
      /* siguiente candidato */
    }
  }
  if (!filledUser) return { outcome: 'LOGIN_FAILED', details: ['no se encontro campo de usuario (getByLabel / autocomplete / name)'] };
  details.push('usuario y password rellenados');

  await password.fill(cfg.password);

  const submit = page.getByRole('button', { name: /iniciar|entrar|ingresar|acceder|login|log in|sign in|acceso|continuar|enviar/i }).first();
  const navWait = page.waitForLoadState('load', { timeout: cfg.navTimeoutMs }).catch(() => undefined);
  if ((await submit.count()) > 0) {
    await submit.click();
    details.push('click en boton de envio (getByRole button)');
  } else {
    await password.press('Enter');
    details.push('Enter en campo password (sin boton detectable)');
  }
  await navWait;
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

  const after = await probeLoginPage(page);
  if (after.mfa.length) return { outcome: 'BLOCKED_MFA', details: [...details, ...after.mfa] };
  if (after.captcha.length) return { outcome: 'BLOCKED_CAPTCHA', details: [...details, ...after.captcha] };
  if (after.isLoginPage) return { outcome: 'LOGIN_FAILED', details: [...details, `sigue en login: ${after.reasons.join(', ')}`] };

  log(`login automatico correcto -> ${page.url()}`);
  return { outcome: 'LOGGED_IN', details };
}

/** Espera a que el operador complete el login manualmente (navegador visible). */
export async function waitForManualLogin(page: Page, timeoutMs: number, log: Logger): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const probe = await probeLoginPage(page);
    if (!probe.isLoginPage) return true;
    if (Date.now() - started < 3000 || Math.floor((Date.now() - started) / 1000) % 15 === 0) {
      log('esperando login manual... (complete el inicio de sesion en el navegador)');
    }
    await page.waitForTimeout(2000);
  }
  return false;
}
