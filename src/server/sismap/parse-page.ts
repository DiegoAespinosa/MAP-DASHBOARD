import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { cleanText, isDateDMY, normalizeColor, parseDateDMY, parseNumber, parseScore, splitCodeAndName } from './values';
import { SismapParseError, type ParsedEvidence, type ParsedIndicator, type ParsedPage } from './types';

const STATUS_WORDS = /^(vencid[oa]|vigente|aprobad[oa]|pendiente|rechazad[oa]|en revisi[oó]n|observad[oa])$/i;

/**
 * Página CargaEvidencia / CargaEvidenciaEdi / PoliticasTransversales (HTML completo).
 * Anclado en etiquetas semánticas (PUNTOS, PESO, RESULTADO, enlaces VerListado), no en posiciones.
 */
export function parseCargaEvidenciaPage(html: string): ParsedPage {
  const $ = cheerio.load(html);

  if ($('input[type="password"]').length && /iniciar sesi/i.test($('body').text())) {
    throw new SismapParseError('LOGIN_PAGE', 'SISMAP devolvió la página de inicio de sesión en lugar de la fuente.');
  }

  const organismName = cleanText($('.local-gob-name h2').first().text()) || null;
  const overallText = $('th:contains("Promedio General") h1').first().text();
  const overallScore = parseNumber(overallText);

  const sections: string[] = [];
  const indicators: ParsedIndicator[] = [];
  let currentSection: string | null = null;
  let current: ParsedIndicator | null = null;

  for (const tr of $('tr').toArray()) {
    const row = $(tr);

    if (row.closest('.info-indicador').length) {
      const title = cleanText(row.find('h4').text() || row.text());
      if (title) {
        currentSection = title;
        sections.push(title);
      }
      continue;
    }

    const ths = row.children('th');
    const rowText = cleanText(row.text());
    const hasValuationLink = row.find('a[href*="GetSubIndicadorColor"]').length > 0;
    if (ths.length && (rowText.includes('PUNTOS') || rowText.includes('Inactivo Temporal') || hasValuationLink)) {
      const head = splitCodeAndName(ths.first().text());
      if (!head) continue;
      const inactive = rowText.includes('Inactivo Temporal');
      const href = row.find('a[href*="GetSubIndicadorColor"]').attr('href') ?? '';
      current = {
        code: head.code,
        name: head.name,
        section: currentSection,
        score: inactive ? null : parseScore(labelledValue($, ths, 'PUNTOS')),
        weight: parseNumber(labelledValue($, ths, 'PESO')),
        weightedResult: parseNumber(labelledValue($, ths, 'RESULTADO')),
        color: normalizeColor(row.find('img').first().attr('alt'), row.find('img').first().attr('src')),
        status: inactive ? 'INACTIVO_TEMPORAL' : null,
        subIndicadorId: /GetSubIndicadorColor\/(\d+)/.exec(href)?.[1] ?? null,
        evidences: [],
      };
      indicators.push(current);
      continue;
    }

    const link = row.find('a[href*="VerListado"]').first();
    if (link.length && current) {
      const evidence = parseEvidenceRow($, tr, link.text(), link.attr('href') ?? '');
      if (evidence) current.evidences.push(evidence);
    }
  }

  if (!indicators.length) {
    throw new SismapParseError('PAGE_STRUCTURE_CHANGED', 'No se encontró ningún sub-indicador con PUNTOS/PESO/RESULTADO en la página.');
  }
  return { organismName, overallScore, sections, indicators };
}

/** Valor numérico que sigue a una etiqueta (PUNTOS, PESO, RESULTADO) dentro de la fila de cabecera. */
function labelledValue($: cheerio.CheerioAPI, ths: cheerio.Cheerio<AnyNode>, label: string): string | null {
  for (const th of ths.toArray()) {
    const text = cleanText($(th).text());
    if (!text.startsWith(label)) continue;
    return text.slice(label.length).trim();
  }
  return null;
}

function parseEvidenceRow($: cheerio.CheerioAPI, tr: AnyNode, linkText: string, href: string): ParsedEvidence | null {
  const head = splitCodeAndName(linkText) ?? { code: cleanText(linkText), name: cleanText(linkText) };
  if (!head.code) return null;
  const cells = $(tr)
    .children('td')
    .toArray()
    .map((td) => cleanText($(td).text()))
    .filter((t) => t && t !== cleanText(linkText));

  let dueDate: Date | null = null;
  let value: number | null = null;
  let status: string | null = null;
  const textCells: string[] = [];
  for (const cell of cells) {
    if (dueDate === null && isDateDMY(cell)) dueDate = parseDateDMY(cell);
    else if (value === null && /^-?\d+(\.\d+)?$/.test(cell)) value = parseNumber(cell);
    else if (STATUS_WORDS.test(cell)) status = cell;
    else textCells.push(cell);
  }
  const verifiedBy = textCells[0] ?? null;
  if (status === null && textCells[1]) status = textCells[1];
  const ref = /cargaEvidenciaID=(\d+)/i.exec(href)?.[1] ?? null;
  return { code: head.code, name: head.name, dueDate, verifiedBy, value, status, externalRef: ref };
}

/** Página Ranking/InformeAnualEdiView: tabla con encabezados semánticos (fallback de la exportación). */
export function parseRankingPage(html: string): { organismName: string | null; values: Record<string, number | null> } {
  const $ = cheerio.load(html);
  const table = $('table')
    .toArray()
    .find((t) => /Nombre Organismo/i.test($(t).text()));
  if (!table) throw new SismapParseError('PAGE_STRUCTURE_CHANGED', 'No se encontró la tabla del ranking.');
  const headers = $(table)
    .find('th')
    .toArray()
    .map((th) => cleanText($(th).text()));
  const dataRow = $(table)
    .find('tr')
    .toArray()
    .find((tr) => $(tr).find('td').length >= headers.length - 1);
  if (!dataRow) throw new SismapParseError('PAGE_STRUCTURE_CHANGED', 'La tabla del ranking no tiene fila de datos.');
  const cells = $(dataRow)
    .find('td')
    .toArray()
    .map((td) => cleanText($(td).text()));
  const values: Record<string, number | null> = {};
  let organismName: string | null = null;
  headers.forEach((h, i) => {
    const cell = cells[i] ?? '';
    if (/Nombre Organismo/i.test(h)) organismName = cell || null;
    else if (!/Posici/i.test(h)) values[h] = parseScore(cell);
  });
  return { organismName, values };
}
