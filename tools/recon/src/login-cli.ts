/**
 * Login manual autorizado: abre un navegador visible, el operador inicia sesion
 * (incluido MFA/CAPTCHA si existen, sin automatizarlos) y se guarda el
 * storageState de Playwright fuera del repositorio para reutilizarlo en `recon`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { loadConfig } from './config.js';
import { probeLoginPage, saveStorageState, waitForManualLogin } from './login.js';
import { Redactor } from './redact.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.MAP_RECON_ROOT ? path.resolve(process.env.MAP_RECON_ROOT) : path.resolve(here, '../../..');
const MANUAL_TIMEOUT_MS = 10 * 60 * 1000;

async function main(): Promise<void> {
  const cfg = loadConfig(ROOT);
  const redactor = new Redactor([cfg.username, cfg.password]);
  const log = (m: string) => console.log(redactor.text(m));
  const target = cfg.loginUrl ?? cfg.sources[0]?.url;
  if (!target) {
    console.error('ERROR: defina MAP_LOGIN_URL o al menos MAP_URL_1 en .env');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, channel: cfg.browserChannel });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    storageState: existsSync(cfg.storageStatePath) ? cfg.storageStatePath : undefined,
  });
  const page = await context.newPage();
  try {
    log(`Abriendo ${redactor.url(target)} - inicie sesion manualmente en la ventana del navegador.`);
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    const probe = await probeLoginPage(page);
    if (probe.captcha.length) log(`CAPTCHA detectado (${probe.captcha.join(', ')}): resuelvalo usted; el sistema no lo automatiza.`);
    if (probe.mfa.length) log(`MFA detectado (${probe.mfa.join(', ')}): complete el segundo factor manualmente.`);

    const ok = probe.isLoginPage ? await waitForManualLogin(page, MANUAL_TIMEOUT_MS, log) : true;
    if (!ok) {
      log('Tiempo agotado sin completar el login. No se guardo ninguna sesion.');
      process.exitCode = 2;
      return;
    }
    await saveStorageState(context, cfg.storageStatePath);
    const cookies = await context.cookies();
    log(`Sesion guardada en ${cfg.storageStatePath} (${cookies.length} cookies: ${cookies.map((c) => c.name).join(', ')})`);
    log('Ahora ejecute `npm run recon`.');
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error('Fallo del login manual:', (e as Error).message ?? e);
  process.exit(1);
});
