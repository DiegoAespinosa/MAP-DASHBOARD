import type { CapturedExchange } from './classify.js';
import type { ReconConfig } from './config.js';
import type { SourceReport } from './types.js';

function yesNo(v: boolean): string {
  return v ? 'SI' : 'NO';
}

function code(s: string): string {
  return `\`${s.replace(/`/g, "'")}\``;
}

function fmtKb(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function endpointLine(ex: CapturedExchange): string {
  const op = ex.graphqlOperation ? ` (${ex.graphqlOperation})` : '';
  return `${ex.method} ${ex.path}${op}`;
}

function renderExchange(ex: CapturedExchange, n: number): string {
  const lines: string[] = [];
  lines.push(`${n}. ${code(endpointLine(ex))}`);
  lines.push(`   - Estado: ${ex.status} · Content-Type: ${ex.contentType || '(sin content-type)'} · Tamano: ${fmtKb(ex.sizeBytes)}`);
  const seen = ex.seenCount && ex.seenCount > 1 ? ` · Visto ${ex.seenCount} veces (fases: ${(ex.phases ?? [ex.phase]).join(', ')})` : '';
  lines.push(`   - Fase: ${ex.phase} (t=${ex.tSec.toFixed(1)}s)${seen} · Mismo origen: ${yesNo(ex.sameOrigin)} · Utilidad: **${ex.utility}**`);
  if (ex.hints.length) lines.push(`   - Pistas en la ruta: ${ex.hints.join(', ')}`);
  const auth: string[] = [];
  const reqLower = Object.fromEntries(Object.entries(ex.requestHeaders).map(([k, v]) => [k.toLowerCase(), v]));
  if (reqLower.authorization) auth.push(`Authorization: ${reqLower.authorization}`);
  if (reqLower.cookie) auth.push(`Cookie: ${reqLower.cookie}`);
  for (const [k, v] of Object.entries(reqLower)) if (/^x-(csrf|xsrf|api|auth)/.test(k)) auth.push(`${k}: ${v}`);
  lines.push(`   - Autenticacion del endpoint: ${auth.length ? auth.join(' · ') : 'ninguna cabecera de auth/cookie observada'}`);
  if (ex.shape) {
    const pag = ex.shape.paginationKeys.length ? ex.shape.paginationKeys.join(', ') : 'no detectada en la respuesta';
    lines.push(`   - Estructura: raiz ${ex.shape.rootType}, array principal ${code(ex.shape.mainArrayPath || '(raiz)')}, ${ex.shape.recordCount} registros · Paginacion: ${pag}`);
    if (ex.shape.fields.length) {
      lines.push(`   - Campos: ${ex.shape.fields.map((f) => `${code(f.name)} (${f.type})`).join(', ')}`);
    }
  }
  if (ex.sampleFile) lines.push(`   - Ejemplo sanitizado: ${code(ex.sampleFile)}`);
  return lines.join('\n');
}

export function renderSourceSection(r: SourceReport): string {
  const s = r.source;
  const p = r.page;
  const out: string[] = [];
  out.push(`## ${s.index}. ${s.name}`);
  out.push('');
  out.push(`- **URL:** ${r.redactedUrl}`);
  out.push(`- **Estado:** ${r.accessibility}${r.preflight.status ? ` (HTTP ${r.preflight.status})` : ''}`);
  if (r.preflight.location) out.push(`- **Redireccion inicial:** ${r.preflight.location}`);
  if (r.preflight.error) out.push(`- **Error de conexion:** ${r.preflight.error}`);
  out.push(`- **Autenticacion:** ${r.auth.summary}`);
  if (r.auth.sessionCookieNames.length) out.push(`- **Cookies de sesion (solo nombres):** ${r.auth.sessionCookieNames.join(', ')}`);
  out.push(`- **Renderizado:** ${p.rendering}${p.frameworkHints.length ? ` (${p.frameworkHints.join(', ')})` : ''}`);
  out.push(`- **Titulo:** ${p.title || '(sin titulo)'}`);
  out.push(`- **Requests analizadas:** ${r.stats.total} (ruido descartado: ${r.stats.noise})`);
  out.push(`- **JSON detectados:** ${r.stats.json} · **GraphQL:** ${r.stats.graphql} · **XHR/fetch:** ${r.stats.xhrFetch} · **WebSockets:** ${r.stats.websockets}`);
  out.push(`- **Tablas HTML:** ${p.tables.count}${p.tables.count ? ` (filas: ${p.tables.rows.join(', ')})` : ''}`);
  if (p.tables.headers.length) out.push(`- **Encabezados de tabla:** ${p.tables.headers.map((h) => h.join(' | ')).join(' // ')}`);
  out.push(`- **JSON embebido en HTML:** ${p.embeddedJson.length ? p.embeddedJson.join(', ') : 'no detectado'}`);
  out.push(`- **Formularios:** ${p.forms.count}${p.forms.count ? ` (${p.forms.methods.join(', ')})` : ''}`);
  out.push(`- **Paginacion en UI:** ${p.paginationHints.length ? p.paginationHints.join(', ') : 'no detectada'}`);
  if (p.iframes.length) out.push(`- **iframes:** ${p.iframes.join(', ')}`);
  out.push(`- **API encontrada:** ${yesNo(r.candidates.length > 0)}`);
  out.push('');

  if (r.candidates.length) {
    out.push('### Endpoints potencialmente utiles');
    out.push('');
    r.candidates.forEach((ex, i) => out.push(renderExchange(ex, i + 1), ''));
  } else {
    out.push('### Endpoints potencialmente utiles');
    out.push('');
    out.push('_No se detectaron respuestas JSON/GraphQL reutilizables durante la navegacion._');
    out.push('');
  }

  if (r.exports.length) {
    out.push('### Exportaciones detectadas (enlaces "Descargar/Exportar")');
    out.push('');
    r.exports.forEach((e, i) => {
      out.push(`${i + 1}. ${code(`GET ${e.path}`)} ("${e.text}")`);
      out.push(`   - Estado: ${e.status} · Content-Type: ${e.contentType || '(sin content-type)'} · Tamano: ${fmtKb(e.sizeBytes)}${e.disposition ? ` · ${e.disposition}` : ''}`);
      out.push(`   - Contenido real: **${e.kind}**${e.columns.length ? ` · ${e.rowCount} filas · Columnas: ${e.columns.map((c) => code(c)).join(', ')}` : ''}${e.requiresSession ? ' · requiere sesion' : ''}`);
      if (e.sampleFile) out.push(`   - Ejemplo sanitizado: ${code(e.sampleFile)}`);
      out.push('');
    });
  }

  const manual = r.exchanges.filter((e) => e.phase === 'manual' && (e.kind === 'JSON' || e.kind === 'GRAPHQL'));
  if (manual.length) {
    out.push('### Acciones de la interfaz y peticiones generadas (fase manual)');
    out.push('');
    out.push('| t (s) | Peticion | Estado | Utilidad |');
    out.push('|---|---|---|---|');
    for (const ex of manual) out.push(`| ${ex.tSec.toFixed(1)} | ${code(endpointLine(ex))} | ${ex.status} | ${ex.utility} |`);
    out.push('');
    out.push('_Correlacione la columna t con las acciones realizadas (seleccionar periodo, abrir detalle, cambiar institucion)._');
    out.push('');
  }

  out.push('### Recomendacion');
  out.push('');
  out.push(`- **Metodo recomendado:** ${r.recommendation.primary}`);
  out.push(`- **Fallback:** ${r.recommendation.fallback}`);
  out.push(`- **Estabilidad estimada:** ${r.recommendation.stability}`);
  out.push(`- **Caso de extraccion:** ${r.recommendation.extractionCase}`);
  for (const line of r.recommendation.rationale) out.push(`- ${line}`);
  if (r.errors.length) {
    out.push('');
    out.push('### Errores durante el reconocimiento');
    out.push('');
    for (const e of r.errors) out.push(`- ${e}`);
  }
  out.push('');
  out.push(`_Artefactos: ${code(r.artifactsDir)} (summary.json, requests.json, samples/, screenshot.png)_`);
  out.push('');
  return out.join('\n');
}

export function renderReport(cfg: ReconConfig, reports: SourceReport[], generatedAt: string): string {
  const out: string[] = [];
  out.push('# Reconocimiento tecnico de las URL del MAP (Fase 1)');
  out.push('');
  out.push(`Generado automaticamente por ${code('tools/recon')} el ${generatedAt}.`);
  out.push('');
  out.push('Todos los valores sensibles (passwords, tokens, cookies, Authorization) aparecen redactados.');
  out.push('Los ejemplos en `samples/` estan sanitizados y truncados. Este informe describe lo observado; no asume endpoints.');
  out.push('');
  out.push('## Resumen');
  out.push('');
  out.push('| Fuente | URL | JSON | API | GraphQL | DOM | Metodo recomendado |');
  out.push('|---|---|---|---|---|---|---|');
  for (const r of reports) {
    const json = r.stats.json > 0 || r.page.embeddedJson.length > 0;
    const api = r.candidates.some((c) => c.kind === 'JSON');
    const gql = r.stats.graphql > 0;
    const dom = r.page.tables.count > 0;
    const exp = r.exports.some((e) => e.columns.length >= 3 && e.rowCount >= 1);
    out.push(`| ${r.source.name} | ${r.redactedUrl} | ${yesNo(json)} | ${yesNo(api)} | ${yesNo(gql)} | ${yesNo(dom)} | ${r.recommendation.primary}${exp ? ' (exportacion tabular)' : ''} |`);
  }
  out.push('');
  out.push(`Sesion de Playwright: ${cfg.headless ? 'headless' : 'con navegador visible'} · Fase manual: ${cfg.interactiveSeconds > 0 ? `${cfg.interactiveSeconds}s` : 'desactivada'}.`);
  out.push('');
  for (const r of reports) out.push(renderSourceSection(r));
  return out.join('\n');
}
