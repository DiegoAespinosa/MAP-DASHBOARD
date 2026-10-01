import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { startFixture } from '../fixtures/server.mjs';

const reconDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** spawn asincrono: spawnSync bloquearia el event loop y el fixture no responderia. */
function runRecon(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/recon.ts'], { cwd: reconDir, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

test('reconocimiento end-to-end contra fixture con login por cookie y API JSON', { timeout: 180_000 }, async () => {
  const { server, url, credentials } = await startFixture();
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'map-recon-'));
  try {
    const env = {
      ...process.env,
      MAP_RECON_ROOT: tmpRoot,
      MAP_URL_1: url,
      MAP_URL_1_NAME: 'Fixture indicadores',
      MAP_USERNAME: credentials.USER,
      MAP_PASSWORD: credentials.PASS,
      MAP_RECON_AUTO_LOGIN: 'true',
      MAP_RECON_HEADLESS: 'true',
      MAP_RECON_INTERACTIVE_SECONDS: '0',
      MAP_STORAGE_STATE: './.secrets/state.json',
    };
    const run = await runRecon(env);
    assert.equal(run.status, 0, `recon fallo:\n${run.stdout}\n${run.stderr}`);

    const reportPath = path.join(tmpRoot, 'docs', 'recon', 'AUTO_REPORT.md');
    assert.ok(existsSync(reportPath), 'debe generar docs/recon/AUTO_REPORT.md');
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /GET \/api\/indicators\?page=1&pageSize=20/);
    assert.match(report, /\*\*Metodo recomendado:\*\* API/);
    assert.match(report, /\| Fixture indicadores \|.*\| SI \| SI \| NO \| SI \| API \(exportacion tabular\) \|/);
    assert.match(report, /Exportaciones detectadas/);

    const summary = JSON.parse(readFileSync(path.join(tmpRoot, 'docs', 'recon', '01-fixture-indicadores', 'summary.json'), 'utf8'));
    assert.equal(summary.accessibility, 'ACCESIBLE');
    assert.equal(summary.auth.outcome, 'LOGGED_IN');
    assert.deepEqual(summary.auth.sessionCookieNames, ['sid']);
    assert.equal(summary.recommendation.primary, 'API');
    assert.equal(summary.page.rendering, 'DINAMICO');
    assert.equal(summary.page.tables.count, 1);
    assert.ok(summary.page.paginationHints.includes('rel=next'));

    const indicators = summary.candidates.find((c) => c.path.startsWith('/api/indicators'));
    assert.ok(indicators, 'debe detectar /api/indicators como candidato');
    assert.equal(indicators.utility, 'ALTA');
    assert.equal(indicators.seenCount, 2, 'debe deduplicar el endpoint visto en login y post-login');
    assert.equal(summary.candidates.filter((c) => c.path.startsWith('/api/indicators')).length, 1);
    assert.equal(indicators.shape.mainArrayPath, 'data');
    assert.equal(indicators.shape.recordCount, 20);
    assert.ok(indicators.shape.fields.some((f) => f.name === 'puntuacion' && f.type === 'number'));
    assert.ok(indicators.shape.fields.some((f) => f.name === 'fecha_limite' && f.type.startsWith('string(fecha')));
    assert.ok(indicators.shape.paginationKeys.includes('totalPages'));
    assert.ok(indicators.shape.paginationKeys.includes('query:page'));
    assert.match(indicators.requestHeaders.cookie, /REDACTED \(1 cookies: sid\)/);

    assert.equal(summary.exports.length, 1, 'debe sondear el enlace Descargar Datos');
    assert.equal(summary.exports[0].kind, 'HTML_TABLE');
    assert.deepEqual(summary.exports[0].columns, ['ID', 'CODIGO', 'INDICADOR', 'VALOR_ACTUAL']);
    assert.equal(summary.exports[0].rowCount, 20);
    assert.ok(existsSync(path.join(tmpRoot, summary.exports[0].sampleFile)));

    const config = summary.candidates.find((c) => c.path.startsWith('/api/config'));
    assert.equal(config, undefined, '/api/config (33 bytes, sin registros) no debe ser candidato');

    // Ningun artefacto puede contener secretos.
    const files = walk(path.join(tmpRoot, 'docs'));
    for (const f of files) {
      if (f.endsWith('.png')) continue;
      const content = readFileSync(f, 'utf8');
      assert.ok(!content.includes(credentials.PASS), `password filtrado en ${f}`);
      assert.ok(!content.includes(credentials.SESSION_VALUE), `cookie de sesion filtrada en ${f}`);
      assert.ok(!content.includes('profile-token-must-be-redacted'), `token de perfil filtrado en ${f}`);
    }
    assert.ok(!run.stdout.includes(credentials.PASS), 'password filtrado en consola');

    assert.ok(existsSync(path.join(tmpRoot, '.secrets', 'state.json')), 'debe guardar storageState');
    assert.ok(existsSync(path.join(tmpRoot, 'docs', 'recon', '01-fixture-indicadores', 'screenshot.png')));
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('URL caida produce estado ERROR y recomendacion PENDIENTE sin abortar', { timeout: 120_000 }, async () => {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'map-recon-down-'));
  try {
    const env = { ...process.env, MAP_RECON_ROOT: tmpRoot, MAP_URL_1: 'http://127.0.0.1:9/', MAP_RECON_NAV_TIMEOUT_MS: '5000' };
    const run = await runRecon(env);
    assert.equal(run.status, 0, run.stderr);
    const summary = JSON.parse(readFileSync(path.join(tmpRoot, 'docs', 'recon', '01-map-fuente-1', 'summary.json'), 'utf8'));
    assert.equal(summary.accessibility, 'ERROR');
    assert.equal(summary.recommendation.primary, 'PENDIENTE');
    assert.ok(summary.preflight.error || summary.errors.length > 0);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
