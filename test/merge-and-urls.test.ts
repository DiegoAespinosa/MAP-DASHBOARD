import { describe, expect, it } from 'vitest';
import { deriveDeadline, mergeExportAndPage } from '@/server/sismap/merge';
import { deriveSource } from '@/server/sismap/urls';
import { rankingCodeFromLabel } from '@/server/sismap/parse-export';
import type { ParsedPage } from '@/server/sismap/types';
import { semaphoreFor } from '@/lib/semaphore';
import { redactText } from '@/lib/redact';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('deriveDeadline', () => {
  const today = d('2026-09-30');
  it('toma el menor vencimiento futuro', () => {
    expect(deriveDeadline([{ dueDate: d('2027-07-01') }, { dueDate: d('2026-10-10') }, { dueDate: d('2026-08-31') }], today)).toEqual({ deadline: d('2026-10-10'), overdue: false });
  });
  it('si todos vencieron, devuelve el más reciente marcado como vencido', () => {
    expect(deriveDeadline([{ dueDate: d('2026-08-31') }, { dueDate: d('2022-03-18') }], today)).toEqual({ deadline: d('2026-08-31'), overdue: true });
  });
  it('hoy cuenta como futuro; sin fechas devuelve null', () => {
    expect(deriveDeadline([{ dueDate: d('2026-09-30') }], today)).toEqual({ deadline: d('2026-09-30'), overdue: false });
    expect(deriveDeadline([{ dueDate: null }], today)).toEqual({ deadline: null, overdue: false });
  });
});

describe('semáforo', () => {
  it('clasifica por días restantes', () => {
    expect(semaphoreFor(-1)).toBe('VENCIDO');
    expect(semaphoreFor(0)).toBe('CRITICO');
    expect(semaphoreFor(3)).toBe('CRITICO');
    expect(semaphoreFor(4)).toBe('ATENCION');
    expect(semaphoreFor(7)).toBe('ATENCION');
    expect(semaphoreFor(8)).toBe('PROXIMO');
    expect(semaphoreFor(15)).toBe('PROXIMO');
    expect(semaphoreFor(16)).toBe('NORMAL');
    expect(semaphoreFor(null)).toBe('SIN_FECHA');
  });
});

describe('mergeExportAndPage', () => {
  const page: ParsedPage = {
    organismName: 'INAPA',
    overallScore: 80,
    sections: ['01'],
    indicators: [
      { code: '01.1', name: 'A', section: '01', score: 100, weight: 4.57, weightedResult: 4.57, color: 'VERDE_OSCURO', status: null, subIndicadorId: '1', evidences: [] },
      { code: '01.4', name: 'Inactivo', section: '01', score: null, weight: null, weightedResult: null, color: null, status: 'INACTIVO_TEMPORAL', subIndicadorId: '4', evidences: [] },
    ],
  };
  it('prefiere la puntuación de la exportación y conserva los solo-página', () => {
    const r = mergeExportAndPage([{ code: '01.1', name: 'A', score: 90, weight: 4.565217, weightedResult: 4.1 }], page);
    expect(r.indicators).toHaveLength(2);
    expect(r.indicators[0]).toMatchObject({ score: 90, weight: 4.565217, color: 'VERDE_OSCURO', section: '01' });
    expect(r.indicators[1].status).toBe('INACTIVO_TEMPORAL');
    expect(r.warnings[0]).toMatch(/01\.1: la página muestra 100/);
  });
  it('añade los que solo están en la exportación con aviso', () => {
    const r = mergeExportAndPage([{ code: '02.1', name: 'Solo export', score: 50, weight: 1, weightedResult: 0.5 }], page);
    expect(r.indicators.find((i) => i.code === '02.1')).toMatchObject({ name: 'Solo export', score: 50, evidences: [] });
    expect(r.warnings.some((w) => w.includes('02.1'))).toBe(true);
  });
});

describe('deriveSource', () => {
  it('deduce tipo y URL de exportación para las 4 rutas de SISMAP', () => {
    expect(deriveSource('https://www.sismap.gob.do/GestionPublica/CargaEvidencia/Index/177?catchall=x')).toEqual({ kind: 'CARGA_EVIDENCIA', exportUrl: 'https://www.sismap.gob.do/GestionPublica/CargaEvidencia/ExportarDatos/177' });
    expect(deriveSource('https://www.sismap.gob.do/GestionPublica/CargaEvidencia/PoliticasTransversales/177')).toEqual({ kind: 'CARGA_EVIDENCIA', exportUrl: 'https://www.sismap.gob.do/GestionPublica/CargaEvidencia/ExportarDatosTransversales/177' });
    expect(deriveSource('https://www.sismap.gob.do/GestionPublica/CargaEvidenciaEdi/Index/177')).toEqual({ kind: 'CARGA_EVIDENCIA', exportUrl: 'https://www.sismap.gob.do/GestionPublica/CargaEvidenciaEdi/ExportarDatos/177' });
    expect(deriveSource('https://www.sismap.gob.do/GestionPublica/Ranking/InformeAnualEdiView')).toEqual({ kind: 'RANKING', exportUrl: 'https://www.sismap.gob.do/GestionPublica/Ranking/ExportarEdi' });
    expect(deriveSource('https://www.sismap.gob.do/GestionPublica/Ranking/RankingEdiView?Length=7')).toEqual({ kind: 'RANKING', exportUrl: 'https://www.sismap.gob.do/GestionPublica/Ranking/ExportarEdi' });
    expect(deriveSource('https://www.sismap.gob.do/otra/cosa')).toBeNull();
  });
});

describe('redactText', () => {
  it('oculta cookies de sesión y tokens', () => {
    expect(redactText('Cookie: .ASPXAUTH=ABC123; ASP.NET_SessionId=xyz')).toBe('Cookie: .ASPXAUTH=[REDACTED]; ASP.NET_SessionId=[REDACTED]');
    expect(redactText('Authorization: Bearer abcdef.ghijkl.mnopqr')).toBe('Authorization: Bearer [REDACTED]');
  });
});

describe('rankingCodeFromLabel', () => {
  it('traduce los rótulos de la página a los códigos de la exportación', () => {
    expect(rankingCodeFromLabel('IDI')).toBe('EDI');
    expect(rankingCodeFromLabel('SISMAP GP')).toBe('SismapGp');
    expect(rankingCodeFromLabel('Políticas Transversales')).toBe('PoliticasTransversales');
    expect(rankingCodeFromLabel('Índice de Cumplimiento')).toBe('IndicedeCumplimiento');
    expect(rankingCodeFromLabel('IPI')).toBe('IndicedeCumplimiento');
    expect(rankingCodeFromLabel('IPS')).toBe('IndicedeProgreso');
    expect(rankingCodeFromLabel('NOBACI / ICI')).toBe('NOBACI');
    expect(rankingCodeFromLabel('Índice de Transparencia Activa')).toBe('SAIP');
    expect(rankingCodeFromLabel('Posición')).toBeNull();
  });
});

describe('scoreBand', () => {
  it('rojo < 60, amarillo 60-75, verde > 75', async () => {
    const { scoreBand } = await import('@/lib/score-band');
    expect(scoreBand(59.9)).toBe('ROJO');
    expect(scoreBand(60)).toBe('AMARILLO');
    expect(scoreBand(75)).toBe('AMARILLO');
    expect(scoreBand(75.1)).toBe('VERDE');
    expect(scoreBand(null)).toBeNull();
  });
});
