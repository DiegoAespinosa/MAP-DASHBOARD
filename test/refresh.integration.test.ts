/**
 * Prueba de integración del motor de actualización contra PostgreSQL (DATABASE_URL del .env)
 * con una sesión SISMAP simulada que devuelve el HTML real guardado en fixtures.
 * Se omite si no hay DATABASE_URL.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const envPath = path.join(process.cwd(), '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const hasDb = !!process.env.DATABASE_URL;

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', 'sismap', name), 'utf8');
const BASE = 'https://www.sismap.gob.do/GestionPublica';

const ROUTES: Array<[RegExp, string]> = [
  [/CargaEvidencia\/ExportarDatos\/177/, 'export-carga-evidencia-177.html'],
  [/CargaEvidencia\/ExportarDatosTransversales\/177/, 'export-politicas-transversales-177.html'],
  [/CargaEvidenciaEdi\/ExportarDatos\/177/, 'export-carga-evidencia-edi-177.html'],
  [/Ranking\/ExportarEdi/, 'export-ranking-edi.html'],
  [/CargaEvidencia\/Index\/177/, 'carga-evidencia-177.html'],
  [/CargaEvidencia\/PoliticasTransversales\/177/, 'politicas-transversales-177.html'],
  [/CargaEvidenciaEdi\/Index\/177/, 'carga-evidencia-edi-177.html'],
  [/Ranking\/InformeAnualEdiView/, 'ranking-informe-anual-edi.html'],
];

function fakeSession(overrides: Record<string, string | Error> = {}) {
  return async () => ({
    request: null as never,
    async fetchText(url: string) {
      for (const [re, body] of Object.entries(overrides)) {
        if (url.includes(re)) {
          if (body instanceof Error) throw body;
          return body;
        }
      }
      const hit = ROUTES.find(([re]) => re.test(url));
      if (!hit) throw new Error(`URL no simulada: ${url}`);
      return fixture(hit[1]);
    },
    async close() {},
  });
}

/** Página mínima con un único sub-indicador para simular una caída drástica de registros. */
const ONE_INDICATOR_PAGE = `<html><body>
<div class="local-gob-name"><h2>INAPA</h2></div>
<table><tr><th><b>Promedio General<span><h1>10 %</h1></span></b></th></tr></table>
<div class="info-indicador"><table><tr><th><h4>01.SECCION</h4></th></tr></table></div>
<table><tr><th><span>01.1 Unico</span></th><th><span>PUNTOS<span><b>10</b></span></span></th><th><img alt="ROJO" src="/x/ROJO.png"></th><th><span>PESO<span><b>1</b></span></span></th><th><span>RESULTADO<span><b>0.1</b></span></span></th><th><a href="/GestionPublica/CargaEvidencia/GetSubIndicadorColor/1">Tabla</a></th></tr></table>
</body></html>`;
const ONE_INDICATOR_EXPORT = `<table><tr><th>OrganismoID</th><th>CODIGO</th><th>INDICADOR</th><th>VALOR_ACTUAL</th><th>PESO</th><th>CALCULO</th></tr><tr><td>177</td><td>01.1</td><td>Unico</td><td>10</td><td>1</td><td>0.1</td></tr></table>`;

describe.skipIf(!hasDb)('actualización contra PostgreSQL', () => {
  let prisma: (typeof import('@/server/db'))['prisma'];
  let runRefresh: (typeof import('@/server/refresh'))['runRefresh'];

  let previouslyEnabled: string[] = [];
  const testStartedAt = new Date();
  const TEST = { sourceId: { startsWith: 'test-' } };

  async function cleanTestData() {
    await prisma.internalNote.deleteMany({ where: { indicator: TEST } });
    await prisma.evidence.deleteMany({ where: { indicator: TEST } });
    await prisma.indicator.deleteMany({ where: TEST });
    await prisma.source.deleteMany({ where: { id: { startsWith: 'test-' } } });
  }

  beforeAll(async () => {
    ({ prisma } = await import('@/server/db'));
    ({ runRefresh } = await import('@/server/refresh'));
    // Las fuentes reales se desactivan durante la prueba y se restauran al final; sus datos no se tocan.
    previouslyEnabled = (await prisma.source.findMany({ where: { enabled: true, NOT: { id: { startsWith: 'test-' } } }, select: { id: true } })).map((s) => s.id);
    await prisma.source.updateMany({ where: { id: { in: previouslyEnabled } }, data: { enabled: false } });
    await prisma.refresh.updateMany({ where: { status: 'RUNNING' }, data: { status: 'FAILED', finishedAt: new Date() } });
    await cleanTestData();
    const sources = [
      ['SISMAP GP', `${BASE}/CargaEvidencia/Index/177?catchall=x`, `${BASE}/CargaEvidencia/ExportarDatos/177`, 'CARGA_EVIDENCIA'],
      ['Vista anual EDI', `${BASE}/Ranking/InformeAnualEdiView`, `${BASE}/Ranking/ExportarEdi`, 'RANKING'],
      ['Implementacion EDI', `${BASE}/CargaEvidenciaEdi/Index/177?catchall=x`, `${BASE}/CargaEvidenciaEdi/ExportarDatos/177`, 'CARGA_EVIDENCIA'],
      ['Politicas Transversales', `${BASE}/CargaEvidencia/PoliticasTransversales/177?catchall=x`, `${BASE}/CargaEvidencia/ExportarDatosTransversales/177`, 'CARGA_EVIDENCIA'],
    ] as const;
    for (const [i, [name, url, exportUrl, kind]] of sources.entries()) {
      await prisma.source.create({ data: { id: `test-${i + 1}`, name, url, exportUrl, kind, sortOrder: i + 1 } });
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.refresh.deleteMany({ where: { startedAt: { gte: testStartedAt } } });
    await prisma.source.updateMany({ where: { id: { in: previouslyEnabled } }, data: { enabled: true } });
  });

  it('primera actualización: crea indicadores y evidencias de las 4 fuentes', async () => {
    const r = await runRefresh({ openSession: fakeSession() });
    expect(r.status).toBe('OK');
    expect(r.sources.map((s) => [s.sourceName, s.status, s.indicators])).toEqual([
      ['SISMAP GP', 'OK', 25],
      ['Vista anual EDI', 'OK', 11],
      ['Implementacion EDI', 'OK', 14],
      ['Politicas Transversales', 'OK', 8],
    ]);
    expect(await prisma.indicator.count({ where: TEST })).toBe(58);
    expect(await prisma.evidence.count({ where: { indicator: TEST } })).toBeGreaterThan(40);
    const s1 = await prisma.source.findUniqueOrThrow({ where: { id: 'test-1' } });
    expect(s1.lastOverallScore).toBe(83.7);
    expect(s1.lastRecordCount).toBe(25);
    expect(s1.lastStatus).toBe('OK');
    const ind = await prisma.indicator.findUniqueOrThrow({ where: { sourceId_code: { sourceId: 'test-1', code: '01.2' } }, include: { evidences: true } });
    expect(ind.score).toBe(100);
    expect(ind.deadline?.toISOString().slice(0, 10)).toBe('2027-07-01'); // menor vencimiento futuro (01.2.3)
    expect(ind.deadlineOverdue).toBe(false);
    expect(ind.evidences.find((e) => e.code === '01.2.2')?.status).toBe('Vencido');
    const refresh = await prisma.refresh.findFirstOrThrow({ orderBy: { startedAt: 'desc' } });
    expect(refresh.status).toBe('OK');
    expect(Array.isArray(refresh.snapshot)).toBe(true);
  });

  it('segunda actualización: actualiza sin duplicar y conserva responsable y notas', async () => {
    const ind = await prisma.indicator.findUniqueOrThrow({ where: { sourceId_code: { sourceId: 'test-1', code: '01.1' } } });
    await prisma.internalNote.create({ data: { indicatorId: ind.id, responsible: 'Juan Pérez', notes: 'Pendiente de enviar' } });

    const r = await runRefresh({ openSession: fakeSession() });
    expect(r.status).toBe('OK');
    expect(r.sources[0]).toMatchObject({ created: 0, updated: 25, missing: 0 });
    expect(await prisma.indicator.count({ where: TEST })).toBe(58);
    const note = await prisma.internalNote.findUniqueOrThrow({ where: { indicatorId: ind.id } });
    expect(note).toMatchObject({ responsible: 'Juan Pérez', notes: 'Pendiente de enviar' });
  });

  it('una fuente que falla no borra sus datos y el resto se actualiza', async () => {
    const r = await runRefresh({ openSession: fakeSession({ 'CargaEvidencia/Index/177': new Error('HTTP 404 al pedir la página') }) });
    expect(r.status).toBe('PARTIAL');
    expect(r.sources[0]).toMatchObject({ status: 'FAILED' });
    expect(r.sources[0].error).toMatch(/404/);
    expect(await prisma.indicator.count({ where: { sourceId: 'test-1', missingSince: null } })).toBe(25);
    const s1 = await prisma.source.findUniqueOrThrow({ where: { id: 'test-1' } });
    expect(s1.lastStatus).toBe('FAILED');
    expect(s1.lastRecordCount).toBe(25);
  });

  it('una caída drástica de registros se marca como anomalía y no reemplaza los datos', async () => {
    const r = await runRefresh({ openSession: fakeSession({ 'CargaEvidencia/Index/177': ONE_INDICATOR_PAGE, 'CargaEvidencia/ExportarDatos/177': ONE_INDICATOR_EXPORT }) });
    expect(r.sources[0]).toMatchObject({ status: 'ANOMALY', indicators: 1 });
    expect(r.sources[0].error).toMatch(/1 indicadores frente a 25/);
    expect(await prisma.indicator.count({ where: { sourceId: 'test-1', missingSince: null } })).toBe(25);
  });

  it('la página de login inesperada se reporta como fallo de la fuente', async () => {
    const login = '<html><body><h1>Iniciar sesión</h1><form><input type="password"></form></body></html>';
    const r = await runRefresh({ openSession: fakeSession({ 'CargaEvidencia/Index/177': login }) });
    expect(r.sources[0].status).toBe('FAILED');
    expect(r.sources[0].error).toMatch(/inicio de sesión/);
  });

  it('DRY_RUN no modifica nada', async () => {
    const before = await prisma.indicator.count({ where: TEST });
    const r = await runRefresh({ dryRun: true, openSession: fakeSession() });
    expect(r.dryRun).toBe(true);
    expect(await prisma.indicator.count({ where: TEST })).toBe(before);
    const refresh = await prisma.refresh.findFirstOrThrow({ orderBy: { startedAt: 'desc' } });
    expect((refresh.summary as { dryRun: boolean }).dryRun).toBe(true);
    expect(refresh.snapshot).toBeNull();
  });

  it('impide dos actualizaciones simultáneas', async () => {
    const running = await prisma.refresh.create({ data: { status: 'RUNNING' } });
    await expect(runRefresh({ openSession: fakeSession() })).rejects.toThrow(/en curso/);
    await prisma.refresh.update({ where: { id: running.id }, data: { status: 'FAILED', finishedAt: new Date() } });
  });
});
