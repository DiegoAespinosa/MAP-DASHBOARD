import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseIndicatorExport, parseRankingExport, parseHtmlTable } from '@/server/sismap/parse-export';
import { parseCargaEvidenciaPage, parseRankingPage } from '@/server/sismap/parse-page';
import { SismapParseError } from '@/server/sismap/types';
import { parseDateDMY, parseScore, splitCodeAndName } from '@/server/sismap/values';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', 'sismap', name), 'utf8');

describe('valores', () => {
  it('convierte fechas dd/mm/aaaa y rechaza inválidas', () => {
    expect(parseDateDMY('20/08/2030')?.toISOString()).toBe('2030-08-20T00:00:00.000Z');
    expect(parseDateDMY('31/02/2027')).toBeNull();
    expect(parseDateDMY('2027-01-01')).toBeNull();
    expect(parseDateDMY('')).toBeNull();
  });
  it('acota puntuaciones a 0-100 y trata -1 como sin dato', () => {
    expect(parseScore('100')).toBe(100);
    expect(parseScore('79.943613')).toBeCloseTo(79.943613);
    expect(parseScore('-1.000000')).toBeNull();
    expect(parseScore('abc')).toBeNull();
  });
  it('separa código y nombre, incluido el prefijo Pt', () => {
    expect(splitCodeAndName('  01.1 Autoevaluación CAF')).toEqual({ code: '01.1', name: 'Autoevaluación CAF' });
    expect(splitCodeAndName('Pt 01.2 Generación de Capacidades')).toEqual({ code: 'Pt 01.2', name: 'Generación de Capacidades' });
    expect(splitCodeAndName('01.1.1 Comité Institucional')).toEqual({ code: '01.1.1', name: 'Comité Institucional' });
    expect(splitCodeAndName('Sin código')).toBeNull();
  });
});

describe('exportación "Descargar Datos"', () => {
  it('lee la tabla HTML servida como .xls (SISMAP GP)', () => {
    const rows = parseIndicatorExport(fixture('export-carga-evidencia-177.html'));
    expect(rows).toHaveLength(23);
    expect(rows[0]).toEqual({ code: '01.1', name: 'Autoevaluación CAF', score: 100, weight: 4.565217391304347, weightedResult: 4.565217 });
    expect(rows.find((r) => r.code === '04.3')?.score).toBe(0);
    expect(rows.find((r) => r.code === '01.4')).toBeUndefined(); // inactivo: no aparece en la exportación
  });
  it('lee EDI y Políticas Transversales (códigos Pt)', () => {
    expect(parseIndicatorExport(fixture('export-carga-evidencia-edi-177.html'))).toHaveLength(14);
    const pt = parseIndicatorExport(fixture('export-politicas-transversales-177.html'));
    expect(pt).toHaveLength(8);
    expect(pt[0].code).toBe('Pt 01.1');
    expect(pt[0].name).toBe('Arquitectura Institucional para la Inclusión del Enfoque de Género');
  });
  it('convierte el ranking en un indicador por índice', () => {
    const r = parseRankingExport(fixture('export-ranking-edi.html'));
    expect(r.organismName).toBe('Instituto Nacional de Aguas Potables y Alcantarillados');
    expect(r.organismId).toBe('14');
    expect(r.indicators).toHaveLength(11);
    expect(r.indicators.find((i) => i.code === 'IGP')?.score).toBeNull();
    expect(r.indicators.find((i) => i.code === 'SismapGp')).toMatchObject({ name: 'SISMAP GP', score: 83.49 });
  });
  it('falla de forma explícita si cambian las columnas o el formato', () => {
    expect(() => parseIndicatorExport('<table><tr><th>ID</th><th>Nombre</th></tr><tr><td>1</td><td>x</td></tr></table>')).toThrowError(SismapParseError);
    expect(() => parseHtmlTable('PK\u0003\u0004binario')).toThrowError(/Excel binario/);
    expect(() => parseHtmlTable('<html><body>sin tabla</body></html>')).toThrowError(/ninguna tabla/);
  });
});

describe('página Carga de Evidencia', () => {
  const page = parseCargaEvidenciaPage(fixture('carga-evidencia-177.html'));

  it('extrae organismo, promedio general y secciones', () => {
    expect(page.organismName).toBe('Instituto Nacional de Aguas Potables y Alcantarillados');
    expect(page.overallScore).toBe(83.7);
    expect(page.sections).toHaveLength(9);
    expect(page.sections[0]).toBe('01.GESTIÓN DE LA CALIDAD Y SERVICIOS');
  });
  it('extrae los 25 sub-indicadores con puntos, peso, resultado y color', () => {
    expect(page.indicators).toHaveLength(25); // 23 en la exportación + 2 "Inactivo Temporal"
    const first = page.indicators[0];
    expect(first).toMatchObject({ code: '01.1', name: 'Autoevaluación CAF', section: '01.GESTIÓN DE LA CALIDAD Y SERVICIOS', score: 100, weight: 4.57, weightedResult: 4.57, color: 'VERDE_OSCURO', status: null, subIndicadorId: '1' });
    const inactive = page.indicators.find((i) => i.code === '01.4');
    expect(inactive).toMatchObject({ status: 'INACTIVO_TEMPORAL', score: null });
    expect(page.indicators.find((i) => i.code === '04.3')).toMatchObject({ score: 0, weightedResult: 0 });
    expect(page.indicators.find((i) => i.code === '09.6')?.section).toBe('09.GESTIÓN DE LAS RELACIONES LABORALES Y SOCIALES');
  });
  it('extrae las evidencias con vencimiento, verificador, valor y estado', () => {
    const first = page.indicators[0];
    expect(first.evidences).toHaveLength(3);
    expect(first.evidences[0]).toEqual({ code: '01.1.1', name: 'Comité Institucional de la Calidad', dueDate: new Date('2030-08-20T00:00:00Z'), verifiedBy: 'Marlen Aguasvivas', value: 20, status: null, externalRef: '291' });
    const plan = page.indicators.find((i) => i.code === '01.2');
    const overdue = plan?.evidences.find((e) => e.code === '01.2.2');
    expect(overdue).toMatchObject({ dueDate: new Date('2026-08-31T00:00:00Z'), value: 0, status: 'Vencido' });
    const total = page.indicators.reduce((n, i) => n + i.evidences.length, 0);
    expect(total).toBeGreaterThan(40);
  });
  it('parsea EDI y Políticas Transversales con la misma plantilla', () => {
    const edi = parseCargaEvidenciaPage(fixture('carga-evidencia-edi-177.html'));
    expect(edi.overallScore).toBe(100);
    expect(edi.indicators).toHaveLength(14);
    expect(edi.indicators.find((i) => i.code === '04.1')?.evidences[0]).toMatchObject({ code: '04.1.1', dueDate: new Date('2026-10-10T00:00:00Z') });
    const pt = parseCargaEvidenciaPage(fixture('politicas-transversales-177.html'));
    expect(pt.overallScore).toBe(81.84);
    expect(pt.indicators).toHaveLength(8);
    expect(pt.indicators[0].code).toBe('Pt 01.1');
    expect(pt.indicators.find((i) => i.code === 'Pt 01.2')).toMatchObject({ score: 0, color: 'ROJO' });
  });
  it('detecta la página de login y la pérdida de estructura', () => {
    expect(() => parseCargaEvidenciaPage('<html><body><h1>Iniciar sesión</h1><form><input type="password"></form></body></html>')).toThrowError(/inicio de sesión/);
    expect(() => parseCargaEvidenciaPage('<html><body><table><tr><td>nada</td></tr></table></body></html>')).toThrowError(/ningún sub-indicador/);
  });
});

describe('página del ranking (fallback)', () => {
  it('lee la tabla con encabezados semánticos', () => {
    const r = parseRankingPage(fixture('ranking-informe-anual-edi.html'));
    expect(r.organismName).toBe('Instituto Nacional de Aguas Potables y Alcantarillados');
    expect(r.values['IDI']).toBeCloseTo(79.94);
    expect(r.values['IGP']).toBeNull();
    expect(r.values['NOBACI']).toBeCloseTo(97.16);
  });
});
