import * as cheerio from 'cheerio';
import { cleanText, normalizeCode, parseNumber, parseScore } from './values';
import { SismapParseError, type ExportRow } from './types';

export interface RawTable {
  columns: string[];
  rows: Record<string, string>[];
}

/** La exportación "Descargar Datos" de SISMAP es una tabla HTML servida como .xls. */
export function parseHtmlTable(body: string): RawTable {
  const head = body.slice(0, 8).toString();
  if (head.startsWith('PK\u0003\u0004') || head.charCodeAt(0) === 0xd0) {
    throw new SismapParseError('EXPORT_FORMAT_CHANGED', 'La exportación ahora es un Excel binario; el parser esperaba una tabla HTML.');
  }
  const $ = cheerio.load(body);
  const table = $('table').first();
  if (!table.length) throw new SismapParseError('EXPORT_FORMAT_CHANGED', 'La exportación no contiene ninguna tabla HTML.');

  const trs = table.find('tr').toArray();
  const headerTr = trs.find((tr) => $(tr).find('th').length > 0) ?? trs[0];
  const columns = $(headerTr)
    .find('th, td')
    .toArray()
    .map((c) => cleanText($(c).text()));
  const rows: Record<string, string>[] = [];
  for (const tr of trs) {
    if (tr === headerTr) continue;
    const cells = $(tr).find('td').toArray();
    if (!cells.length) continue;
    const row: Record<string, string> = {};
    cells.forEach((c, i) => {
      row[columns[i] ?? `col${i}`] = cleanText($(c).text());
    });
    rows.push(row);
  }
  return { columns, rows };
}

export const INDICATOR_EXPORT_COLUMNS = ['CODIGO', 'INDICADOR', 'VALOR_ACTUAL', 'PESO', 'CALCULO'] as const;

/** Exportación de CargaEvidencia / CargaEvidenciaEdi / PoliticasTransversales. */
export function parseIndicatorExport(body: string): ExportRow[] {
  const table = parseHtmlTable(body);
  const missing = INDICATOR_EXPORT_COLUMNS.filter((c) => !table.columns.includes(c));
  if (missing.length) {
    throw new SismapParseError('EXPORT_COLUMNS_MISSING', `Faltan columnas en la exportación: ${missing.join(', ')}. Encontradas: ${table.columns.join(', ')}`);
  }
  return table.rows
    .filter((r) => r.CODIGO)
    .map((r) => ({
      code: normalizeCode(r.CODIGO),
      name: cleanText(r.INDICADOR),
      score: parseScore(r.VALOR_ACTUAL),
      weight: parseNumber(r.PESO),
      weightedResult: parseNumber(r.CALCULO),
    }));
}

/** Columnas del ranking EDI que son índices (el resto identifica al organismo). */
export const RANKING_INDEX_LABELS: Record<string, string> = {
  EDI: 'IDI',
  SismapGp: 'SISMAP GP',
  IGP: 'IGP',
  SISCOMPRAS: 'SISCOMPRAS',
  ITICGE: 'ITICGE',
  NOBACI: 'NOBACI / ICI',
  SAIP: 'Índice de Transparencia Activa (SAIP)',
  PoliticasTransversales: 'Políticas Transversales',
  IndicedeCumplimiento: 'IPI',
  IndicedeProgreso: 'IPS',
  SatisfaccionCiudadana: 'Satisfacción Ciudadana',
};

/** Rótulos de la tabla de la página del ranking -> código de columna de la exportación. */
const RANKING_LABEL_TO_CODE: Record<string, string> = {
  idi: 'EDI',
  edi: 'EDI',
  igp: 'IGP',
  siscompras: 'SISCOMPRAS',
  sismapgp: 'SismapGp',
  iticge: 'ITICGE',
  nobaci: 'NOBACI',
  nobaciici: 'NOBACI',
  saip: 'SAIP',
  indicedetransparenciaactiva: 'SAIP',
  indicedetransparenciaactivasaip: 'SAIP',
  politicastransversales: 'PoliticasTransversales',
  indicedecumplimiento: 'IndicedeCumplimiento',
  ipi: 'IndicedeCumplimiento',
  indicedeprogreso: 'IndicedeProgreso',
  ips: 'IndicedeProgreso',
  satisfaccionciudadana: 'SatisfaccionCiudadana',
};

export function rankingCodeFromLabel(label: string): string | null {
  const key = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  return RANKING_LABEL_TO_CODE[key] ?? null;
}

export interface RankingExport {
  organismName: string | null;
  organismId: string | null;
  indicators: ExportRow[];
}

/** Exportación de Ranking/ExportarEdi: una fila por organismo; cada columna de índice pasa a ser un indicador. */
export function parseRankingExport(body: string): RankingExport {
  const table = parseHtmlTable(body);
  const row = table.rows[0];
  if (!row) throw new SismapParseError('EXPORT_FORMAT_CHANGED', 'La exportación del ranking no tiene filas.');
  const indexColumns = table.columns.filter((c) => c in RANKING_INDEX_LABELS);
  if (indexColumns.length < 3) {
    throw new SismapParseError('EXPORT_COLUMNS_MISSING', `El ranking no contiene las columnas de índices esperadas. Encontradas: ${table.columns.join(', ')}`);
  }
  return {
    organismName: cleanText(row.nombreOrganismo) || null,
    organismId: cleanText(row.ID) || null,
    indicators: indexColumns.map((c) => ({
      code: c,
      name: RANKING_INDEX_LABELS[c],
      score: parseScore(row[c]),
      weight: null,
      weightedResult: null,
    })),
  };
}
