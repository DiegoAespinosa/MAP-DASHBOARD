/**
 * Sondeo de enlaces de exportacion ("Descargar datos", "Exportar", "Excel", "CSV").
 * Muchas aplicaciones server-rendered no exponen JSON pero si una exportacion
 * tabular estable. Se descarga con la sesion del contexto y se clasifica.
 */
import type { BrowserContext, Page } from 'playwright';
import { tryParseJson, inferShape, type JsonShape } from './classify.js';
import type { Redactor } from './redact.js';

export type ExportKind = 'HTML_TABLE' | 'CSV' | 'JSON' | 'XLSX' | 'XLS_BINARIO' | 'PDF' | 'HTML' | 'OTRO';

export interface ExportProbe {
  text: string;
  url: string;
  path: string;
  status: number;
  contentType: string;
  disposition?: string;
  sizeBytes: number;
  kind: ExportKind;
  columns: string[];
  rowCount: number;
  shape?: JsonShape;
  requiresSession?: boolean;
  sampleFile?: string;
  /** Cuerpo textual sanitizado (solo para HTML_TABLE/CSV/JSON pequenos); no se escribe en summary.json. */
  sampleBody?: string;
}

const LINK_TEXT_RE = /^(descargar|exportar|export|bajar|excel|csv|xls)\b/i;
const MAX_LINKS = 10;
const MAX_BODY = 3_000_000;

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(aacute|eacute|iacute|oacute|uacute|ntilde|Aacute|Eacute|Iacute|Oacute|Uacute|Ntilde|nbsp|amp|lt|gt|quot);/g, (_m, e: string) => {
      const map: Record<string, string> = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"' };
      return map[e] ?? '';
    });
}

export function analyzeHtmlTable(html: string): { columns: string[]; rowCount: number } {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { columns: [], rowCount: 0 };
  const table = tableMatch[0];
  const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const headerRow = rows.find((r) => /<th/i.test(r)) ?? rows[0] ?? '';
  const columns = (headerRow.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) ?? []).map((c) =>
    decodeEntities(c.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
  );
  const dataRows = rows.filter((r) => /<td/i.test(r)).length;
  return { columns, rowCount: dataRows };
}

function classify(contentType: string, disposition: string | undefined, body: Buffer): { kind: ExportKind; text?: string } {
  const magic = body.subarray(0, 4).toString('hex');
  if (magic === '504b0304') return { kind: 'XLSX' };
  if (magic === 'd0cf11e0') return { kind: 'XLS_BINARIO' };
  if (body.subarray(0, 5).toString() === '%PDF-') return { kind: 'PDF' };
  const text = body.toString('utf8');
  const head = text.slice(0, 4000);
  if (tryParseJson(head.trimStart().startsWith('{') || head.trimStart().startsWith('[') ? text : '') !== undefined) return { kind: 'JSON', text };
  if (/<table[\s>]/i.test(head)) return { kind: 'HTML_TABLE', text };
  if (/<html|<div|<body/i.test(head)) return { kind: 'HTML', text };
  const lines = head.split(/\r?\n/).filter(Boolean);
  const sep = lines[0]?.includes(';') ? ';' : lines[0]?.includes('\t') ? '\t' : ',';
  if (lines.length >= 2 && lines[0].split(sep).length >= 2 && lines[0].split(sep).length === lines[1].split(sep).length) return { kind: 'CSV', text };
  if (/csv|text\/plain/i.test(contentType) || /\.csv/i.test(disposition ?? '')) return { kind: 'CSV', text };
  return { kind: 'OTRO' };
}

export async function probeExportLinks(
  page: Page,
  context: BrowserContext,
  origin: string,
  redactor: Redactor,
  log: (m: string) => void,
): Promise<ExportProbe[]> {
  const links = await page
    .evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({ text: ((a as HTMLElement).innerText || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim(), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.href && !/^(javascript:|mailto:|tel:|#)/i.test(l.href)),
    )
    .catch(() => [] as Array<{ text: string; href: string }>);

  const seen = new Set<string>();
  const targets = links.filter((l) => {
    if (!LINK_TEXT_RE.test(l.text) || !l.href.startsWith(origin) || seen.has(l.href)) return false;
    if (/uploads\/|\.(pdf|docx?|pptx?|zip|png|jpe?g)(\?|$)/i.test(l.href)) return false;
    seen.add(l.href);
    return true;
  });
  const results: ExportProbe[] = [];
  for (const l of targets.slice(0, MAX_LINKS)) {
    const redactedUrl = redactor.url(l.href);
    const path = (() => {
      try {
        const u = new URL(redactedUrl);
        return u.pathname + u.search;
      } catch {
        return redactedUrl;
      }
    })();
    try {
      const res = await context.request.get(l.href, { maxRedirects: 0, timeout: 60_000 });
      const headers = res.headers();
      const body = await res.body();
      const contentType = (headers['content-type'] ?? '').split(';')[0].trim();
      const probe: ExportProbe = {
        text: redactor.text(l.text).slice(0, 60),
        url: redactedUrl,
        path,
        status: res.status(),
        contentType,
        disposition: headers['content-disposition'] ? redactor.text(headers['content-disposition']).slice(0, 120) : undefined,
        sizeBytes: body.length,
        kind: 'OTRO',
        columns: [],
        rowCount: 0,
      };
      if (res.status() >= 200 && res.status() < 300 && body.length <= MAX_BODY) {
        const c = classify(contentType, headers['content-disposition'], body);
        probe.kind = c.kind;
        if (c.kind === 'HTML_TABLE' && c.text) {
          const t = analyzeHtmlTable(c.text);
          probe.columns = t.columns.map((x) => redactor.text(x));
          probe.rowCount = t.rowCount;
          probe.sampleBody = redactor.text(c.text).slice(0, 20_000);
        } else if (c.kind === 'CSV' && c.text) {
          const lines = c.text.split(/\r?\n/).filter(Boolean);
          const sep = lines[0]?.includes(';') ? ';' : lines[0]?.includes('\t') ? '\t' : ',';
          probe.columns = (lines[0] ?? '').split(sep).map((x) => redactor.text(x.trim()));
          probe.rowCount = Math.max(0, lines.length - 1);
          probe.sampleBody = redactor.text(lines.slice(0, 6).join('\n'));
        } else if (c.kind === 'JSON' && c.text) {
          const parsed = tryParseJson(c.text);
          if (parsed !== undefined) {
            probe.shape = inferShape(parsed);
            probe.columns = probe.shape.fields.map((f) => f.name);
            probe.rowCount = probe.shape.recordCount;
            probe.sampleBody = JSON.stringify(redactor.json(parsed), null, 2).slice(0, 20_000);
          }
        }
      } else if (res.status() >= 300 && res.status() < 400 && /login|auth/i.test(headers['location'] ?? '')) {
        probe.requiresSession = true;
      }
      results.push(probe);
      log(`  exportacion "${probe.text}" ${probe.path} -> ${probe.status} ${probe.kind}${probe.columns.length ? ` columnas=${probe.columns.length} filas=${probe.rowCount}` : ''}`);
    } catch (e) {
      log(`  exportacion "${l.text}" fallo: ${redactor.text(String((e as Error).message ?? e)).slice(0, 120)}`);
    }
  }
  return results;
}
