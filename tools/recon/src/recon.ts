/**
 * Fase 1 - Reconocimiento tecnico de URLs del MAP.
 *
 * Abre cada MAP_URL_n con Playwright usando la sesion autorizada, escucha el
 * trafico de red, clasifica respuestas (JSON / GraphQL / HTML / DOM), infiere
 * campos y genera docs/MAP_RECONNAISSANCE.md + artefactos sanitizados.
 *
 * NO es el scraper definitivo. No asume endpoints ni selectores del MAP.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright';

import {
  detectKind,
  detectQueryPagination,
  findHints,
  graphqlOperationName,
  inferShape,
  isNoise,
  safePath,
  scoreUtility,
  tryParseJson,
  dedupeExchanges,
  type CapturedExchange,
} from './classify.js';
import { loadConfig, slugify, validateSources, type ReconConfig, type SourceInput } from './config.js';
import { attemptAutoLogin, probeLoginPage, saveStorageState, type AuthOutcome } from './login.js';
import { probeExportLinks, type ExportProbe } from './exports.js';
import { Redactor, isSensitiveKey } from './redact.js';
import { renderReport } from './report.js';
import type { Accessibility, Method, PageFacts, Rendering, SourceReport } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.MAP_RECON_ROOT ? path.resolve(process.env.MAP_RECON_ROOT) : path.resolve(here, '../../..');

const REQ_HEADER_KEEP = new Set(['accept', 'content-type', 'authorization', 'cookie', 'x-requested-with', 'referer', 'origin']);
const RES_HEADER_KEEP = new Set(['content-type', 'cache-control', 'server', 'x-powered-by', 'set-cookie', 'vary', 'access-control-allow-origin', 'content-encoding']);

function pickHeaders(headers: Record<string, string>, keep: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (keep.has(lower) || lower.startsWith('x-')) out[lower] = v;
  }
  return out;
}

function redactPostData(redactor: Redactor, postData: string): unknown {
  const parsed = tryParseJson(postData);
  if (parsed !== undefined) return redactor.json(parsed);
  if (/^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(postData.slice(0, 5000))) {
    const params = new URLSearchParams(postData);
    const obj: Record<string, string> = {};
    for (const [k, v] of params.entries()) obj[k] = isSensitiveKey(k) ? 'REDACTED' : redactor.text(v).slice(0, 200);
    return obj;
  }
  return redactor.text(postData.slice(0, 1000));
}

function stripHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function frameworkHintsFromHtml(html: string): string[] {
  const hints: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/__NEXT_DATA__|\/_next\//, 'Next.js'],
    [/__NUXT__|\/_nuxt\//, 'Nuxt'],
    [/ng-version=|ng-app|angular/i, 'Angular'],
    [/data-reactroot|react-dom|__reactContainer/i, 'React'],
    [/data-v-app|vue(\.min)?\.js|__vue__/i, 'Vue'],
    [/_framework\/blazor/i, 'Blazor'],
    [/__VIEWSTATE|__EVENTVALIDATION/, 'ASP.NET WebForms'],
    [/__RequestVerificationToken/, 'ASP.NET MVC/Razor'],
    [/wire:id|livewire/i, 'Livewire'],
    [/wp-content|wp-includes/i, 'WordPress'],
    [/app\.powerbi\.com|powerbi\.com\/(view|reportEmbed)/i, 'Power BI embebido'],
    [/tableau/i, 'Tableau'],
    [/lookerstudio|datastudio\.google/i, 'Looker Studio'],
    [/metabase/i, 'Metabase'],
    [/grafana/i, 'Grafana'],
    [/arcgis/i, 'ArcGIS'],
    [/datatables(\.min)?\.js|dataTables/i, 'DataTables (jQuery)'],
    [/jquery/i, 'jQuery'],
    [/kendo/i, 'Kendo UI'],
    [/telerik/i, 'Telerik'],
    [/devexpress|dx\./i, 'DevExpress'],
    [/primeng|primefaces|primereact/i, 'PrimeFaces/PrimeNG'],
    [/javax\.faces|jsf/i, 'JSF'],
  ];
  for (const [re, name] of checks) if (re.test(html)) hints.push(name);
  return hints;
}

async function collectPageFacts(page: Page, initialHtml: string, redactor: Redactor, errors: string[]): Promise<PageFacts> {
  // Sin funciones auxiliares con nombre dentro de evaluate (ver login.ts).
  const dom = await page
    .evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table')).map((t) => ({
        rows: t.querySelectorAll('tr').length,
        headers: Array.from(t.querySelectorAll('th'))
          .slice(0, 15)
          .map((th) => ((th as HTMLElement).innerText || '').trim())
          .filter(Boolean),
      }));
      const embedded: string[] = [];
      const jsonScripts = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
      if (jsonScripts.length) embedded.push(`${jsonScripts.length} script[type=application/json]`);
      if (document.getElementById('__NEXT_DATA__')) embedded.push('__NEXT_DATA__');
      const inline = Array.from(document.querySelectorAll('script:not([src])'))
        .map((s) => s.textContent || '')
        .join('\n');
      const globals = inline.match(/window\.(__[A-Z_]{3,}__|[A-Za-z_]*(?:INITIAL|PRELOADED|BOOTSTRAP)[A-Za-z_]*)\s*=/g) || [];
      for (const g of Array.from(new Set(globals))) embedded.push(g.replace(/\s*=$/, ''));
      const forms = Array.from(document.forms).map((f) => (f.getAttribute('method') || 'get').toUpperCase());
      const pag: string[] = [];
      if (document.querySelector('[rel="next"]')) pag.push('rel=next');
      if (document.querySelector('nav[aria-label*="pag" i], .pagination, .paginator, .dataTables_paginate, .p-paginator, .MuiPagination-root')) pag.push('componente de paginacion');
      const clickable = Array.from(document.querySelectorAll('a, button')).filter((el) => /^(siguiente|next|›|»|>|>>)$/i.test(((el as HTMLElement).innerText || '').trim()));
      if (clickable.length) pag.push(`boton "${((clickable[0] as HTMLElement).innerText || '').trim()}"`);
      if (document.querySelector('select[name*="page" i], select[name*="length" i], select[name*="size" i]')) pag.push('selector de tamano de pagina');
      const iframes = Array.from(document.querySelectorAll('iframe')).map((f) => (f.getAttribute('src') || '(sin src)').slice(0, 120));
      const domHints: string[] = [];
      if (document.querySelector('[ng-version]')) domHints.push('Angular');
      if (document.querySelector('#__next, [data-reactroot]')) domHints.push('React/Next.js');
      if (document.querySelector('#__nuxt')) domHints.push('Nuxt');
      if (document.querySelector('[data-v-app]')) domHints.push('Vue');
      if (document.querySelector('input[name="__VIEWSTATE"]')) domHints.push('ASP.NET WebForms');
      if (document.querySelector('[wire\\:id]')) domHints.push('Livewire');
      return {
        title: document.title || '',
        finalUrl: location.href,
        domTextChars: (document.body?.innerText || '').length,
        tables,
        embedded,
        forms,
        pag,
        iframes,
        domHints,
        links: document.querySelectorAll('a[href]').length,
      };
    })
    .catch((e: unknown) => {
      errors.push(`evaluate DOM: ${redactor.text(String((e as Error).message ?? e)).slice(0, 200)}`);
      return null;
    });

  const initialText = stripHtmlText(initialHtml);
  const hints = Array.from(new Set([...frameworkHintsFromHtml(initialHtml), ...(dom?.domHints ?? [])]));

  let rendering: Rendering = 'DESCONOCIDO';
  if (dom && initialHtml) {
    const i = initialText.length;
    const d = dom.domTextChars;
    if (d > i * 2 && d - i > 500) rendering = 'DINAMICO';
    else if (d <= i * 1.2 + 200) rendering = 'ESTATICO';
    else rendering = 'MIXTO';
  }

  return {
    finalUrl: dom ? redactor.url(dom.finalUrl) : '',
    title: dom ? redactor.text(dom.title) : '',
    rendering,
    frameworkHints: hints,
    initialHtmlBytes: Buffer.byteLength(initialHtml, 'utf8'),
    initialTextChars: initialText.length,
    domTextChars: dom?.domTextChars ?? 0,
    tables: {
      count: dom?.tables.length ?? 0,
      rows: dom?.tables.map((t) => t.rows) ?? [],
      headers: dom?.tables.map((t) => t.headers.map((h) => redactor.text(h))).filter((h) => h.length) ?? [],
    },
    embeddedJson: dom?.embedded ?? [],
    forms: { count: dom?.forms.length ?? 0, methods: Array.from(new Set(dom?.forms ?? [])) },
    paginationHints: dom?.pag ?? [],
    iframes: (dom?.iframes ?? []).map((s) => redactor.url(s)),
    links: dom?.links ?? 0,
  };
}

function recommend(r: Omit<SourceReport, 'recommendation'>): SourceReport['recommendation'] {
  const rationale: string[] = [];
  const authRequired = r.auth.outcome !== 'NOT_REQUIRED';
  const authLabel = r.auth.bearerObserved ? 'token Bearer' : r.auth.sessionCookieNames.length ? 'cookie de sesion' : 'sin autenticacion observada';

  if (r.accessibility === 'ERROR') {
    return { primary: 'PENDIENTE', fallback: '-', stability: 'N/A', extractionCase: '-', rationale: ['La URL no pudo abrirse; corrija conectividad/URL y repita el reconocimiento.'] };
  }
  if (r.accessibility === 'BLOQUEADA') {
    return { primary: 'PENDIENTE', fallback: '-', stability: 'N/A', extractionCase: '-', rationale: [`Acceso bloqueado por ${r.auth.summary}. No se intenta evadir; requiere sesion manual autorizada (npm run recon:login).`] };
  }
  if (r.accessibility === 'REQUIERE_LOGIN') {
    return { primary: 'PENDIENTE', fallback: '-', stability: 'N/A', extractionCase: '-', rationale: ['La pagina exige login y no habia sesion valida. Ejecute `npm run recon:login` y repita.'] };
  }

  const usableExports = r.exports.filter((e) => (e.kind === 'HTML_TABLE' || e.kind === 'CSV' || e.kind === 'JSON') && e.columns.length >= 3 && e.rowCount >= 1);
  const alta = r.candidates.filter((c) => c.utility === 'ALTA');
  const media = r.candidates.filter((c) => c.utility === 'MEDIA');
  const gqlAlta = alta.filter((c) => c.kind === 'GRAPHQL');
  const jsonAlta = alta.filter((c) => c.kind === 'JSON');
  const bi = r.page.frameworkHints.filter((h) => /Power BI|Tableau|Looker|Metabase|Grafana|ArcGIS/.test(h));
  const fallback = r.page.tables.count > 0 ? 'DOM (tablas HTML presentes)' : 'DOM';
  const extractionCase = authRequired ? 'B (JSON dentro de navegacion autenticada: reutilizar cookies/storageState o request context)' : 'A (API/JSON reutilizable sin sesion)';

  if (gqlAlta.length) {
    rationale.push(`${gqlAlta.length} operacion(es) GraphQL con datos estructurados; autenticacion: ${authLabel}.`);
    return { primary: 'GRAPHQL', fallback, stability: 'ALTA', extractionCase, rationale };
  }
  if (jsonAlta.length) {
    rationale.push(`${jsonAlta.length} endpoint(s) JSON de utilidad ALTA en el mismo origen; autenticacion: ${authLabel}.`);
    rationale.push('Preferir API/JSON sobre DOM (regla de calidad 37). Confirmar manualmente el mapeo de campos antes de la Fase 7.');
    return { primary: 'API', fallback, stability: 'ALTA', extractionCase, rationale };
  }
  if (media.length) {
    rationale.push(`Solo endpoints JSON de utilidad MEDIA (${media.length}); revisar samples/ para confirmar que contienen los indicadores.`);
    rationale.push('Si la fase manual (MAP_RECON_INTERACTIVE_SECONDS) no se ejecuto, repetirla navegando por filtros y detalles.');
    return { primary: 'API', fallback, stability: 'MEDIA', extractionCase, rationale };
  }
  if (usableExports.length) {
    for (const e of usableExports) rationale.push(`Exportacion tabular estable: "${e.text}" -> ${e.path} (${e.kind}, ${e.columns.length} columnas: ${e.columns.slice(0, 8).join(', ')}; ${e.rowCount} filas).`);
    rationale.push('Sin JSON/API, pero la exportacion ofrece columnas semanticas; usarla como fuente principal y el DOM para los datos que no incluya.');
    return { primary: 'CUSTOM', fallback, stability: 'MEDIA', extractionCase: 'D (exportacion tabular + DOM complementario)', rationale };
  }
  if (bi.length) {
    rationale.push(`La pagina embebe un visor de BI (${bi.join(', ')}); los datos no viajan como JSON reutilizable ni como tabla HTML estable.`);
    rationale.push('Requiere estrategia CUSTOM (exportacion oficial, API del visor si esta autorizada, o captura por iframe) a documentar en Fase 2.');
    return { primary: 'CUSTOM', fallback: 'DOM del iframe', stability: 'BAJA', extractionCase: 'D (estrategia especial)', rationale };
  }
  if (r.page.embeddedJson.length) {
    rationale.push(`Datos embebidos en el HTML (${r.page.embeddedJson.join(', ')}); extraer del documento sin depender del DOM renderizado.`);
    return { primary: 'JSON', fallback, stability: 'MEDIA', extractionCase: authRequired ? 'B (HTML autenticado con JSON embebido)' : 'A (JSON embebido)', rationale };
  }
  if (r.page.tables.count > 0) {
    rationale.push(`Sin JSON reutilizable; ${r.page.tables.count} tabla(s) HTML con encabezados semanticos. Usar selectores por rol/encabezado, no posicionales.`);
    return { primary: 'DOM', fallback: 'ninguno (ultimo recurso)', stability: r.page.rendering === 'ESTATICO' ? 'MEDIA' : 'BAJA', extractionCase: 'C (DOM scraping)', rationale };
  }
  rationale.push('No se detecto JSON, GraphQL, JSON embebido ni tablas HTML durante la navegacion automatica.');
  rationale.push('Repetir con MAP_RECON_HEADLESS=false y MAP_RECON_INTERACTIVE_SECONDS>0 para navegar manualmente; si persiste, estrategia CUSTOM.');
  return { primary: 'CUSTOM', fallback: 'DOM', stability: 'BAJA', extractionCase: 'D (pendiente de navegacion manual)', rationale };
}

async function analyzeSource(browser: Browser, cfg: ReconConfig, source: SourceInput, redactor: Redactor, log: (m: string) => void): Promise<SourceReport> {
  const startedAt = new Date();
  const artifactsDirAbs = path.join(cfg.outDir, source.slug);
  const samplesDir = path.join(artifactsDirAbs, 'samples');
  mkdirSync(samplesDir, { recursive: true });
  const artifactsDir = path.relative(cfg.rootDir, artifactsDirAbs).replace(/\\/g, '/');

  const hasState = existsSync(cfg.storageStatePath);
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'es-DO',
    storageState: hasState ? cfg.storageStatePath : undefined,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(cfg.navTimeoutMs);

  const origin = new URL(source.url).origin;
  const t0 = Date.now();
  let phase = 'load';
  let nextId = 1;
  let total = 0;
  let noise = 0;
  let websockets = 0;
  let xhrFetch = 0;
  let html = 0;
  let initialHtml = '';
  const exchanges: CapturedExchange[] = [];
  const parsedBodies = new Map<number, unknown>();
  const pending: Promise<void>[] = [];
  const errors: string[] = [];
  let exportsFound: ExportProbe[] = [];

  page.on('websocket', (ws) => {
    websockets++;
    log(`  websocket: ${redactor.url(ws.url())}`);
  });

  const handleResponse = async (response: Response): Promise<void> => {
    const request = response.request();
    const rawUrl = request.url();
    total++;
    if (isNoise(rawUrl)) {
      noise++;
      return;
    }
    const resourceType = request.resourceType();
    if (resourceType === 'xhr' || resourceType === 'fetch') xhrFetch++;
    const status = response.status();
    const resHeaders = await response.allHeaders().catch(() => response.headers());
    const contentType = resHeaders['content-type'] ?? '';
    const isNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();

    let bodyText: string | undefined;
    let sizeBytes = Number(resHeaders['content-length']) || 0;
    const wantBody = isNavigation || ['xhr', 'fetch', 'other', 'document'].includes(resourceType) || /json|graphql|xml|text\/plain/i.test(contentType);
    if (wantBody && status !== 204 && !(status >= 300 && status < 400)) {
      try {
        const buf = await response.body();
        sizeBytes = buf.length;
        if (buf.length <= cfg.maxBodyBytes) bodyText = buf.toString('utf8');
      } catch {
        /* cuerpo no disponible (p. ej. redirect o request cancelada) */
      }
    }
    if (isNavigation && status < 300 && !initialHtml && /html/i.test(contentType) && bodyText) initialHtml = bodyText;

    const method = request.method();
    const postData = request.postData();
    const kind = detectKind({ contentType, url: rawUrl, method, postData, bodyText });
    if (kind === 'HTML') html++;
    if (kind === 'JS' || kind === 'CSS' || kind === 'BINARY') return;

    const id = nextId++;
    let shape: CapturedExchange['shape'];
    if ((kind === 'JSON' || kind === 'GRAPHQL') && bodyText) {
      const parsed = tryParseJson(bodyText);
      if (parsed !== undefined) {
        shape = inferShape(parsed);
        shape.paginationKeys.push(...detectQueryPagination(rawUrl).map((k) => `query:${k}`));
        parsedBodies.set(id, parsed);
      }
    }
    const reqHeadersRaw = await request.allHeaders().catch(() => request.headers());
    const redactedUrl = redactor.url(rawUrl);
    const ex: CapturedExchange = {
      id,
      phase,
      tSec: (Date.now() - t0) / 1000,
      method,
      url: redactedUrl,
      path: safePath(redactedUrl),
      sameOrigin: rawUrl.startsWith(origin),
      resourceType,
      status,
      contentType: contentType.split(';')[0].trim(),
      kind,
      sizeBytes,
      requestHeaders: redactor.headers(pickHeaders(reqHeadersRaw, REQ_HEADER_KEEP)),
      requestBody: postData ? redactPostData(redactor, postData) : undefined,
      responseHeaders: redactor.headers(pickHeaders(resHeaders, RES_HEADER_KEEP)),
      hints: findHints(rawUrl),
      shape,
      graphqlOperation: kind === 'GRAPHQL' ? graphqlOperationName(postData) : undefined,
      utility: 'N/A',
      noise: false,
      isNavigation,
    };
    ex.utility = scoreUtility(ex);
    exchanges.push(ex);
    if (kind === 'JSON' || kind === 'GRAPHQL') {
      log(`  [t=${ex.tSec.toFixed(1)}s][${phase}] ${method} ${ex.path} -> ${status} ${kind} ${sizeBytes}B utilidad=${ex.utility}`);
    }
  };
  page.on('response', (response) => {
    pending.push(handleResponse(response).catch((e) => { errors.push(`captura de respuesta: ${redactor.text(String(e))}`); }));
  });

  // 1) Preflight HTTP sin seguir redirecciones (comparte cookies del contexto).
  const preflight: SourceReport['preflight'] = {};
  try {
    const res = await context.request.get(source.url, { maxRedirects: 0, timeout: cfg.navTimeoutMs });
    preflight.status = res.status();
    const h = res.headers();
    if (h.location) preflight.location = redactor.url(h.location);
    preflight.contentType = (h['content-type'] ?? '').split(';')[0].trim();
    log(`  preflight: HTTP ${preflight.status}${preflight.location ? ` -> ${preflight.location}` : ''}`);
  } catch (e) {
    preflight.error = redactor.text(String((e as Error).message ?? e)).slice(0, 300);
    log(`  preflight: ERROR ${preflight.error}`);
  }

  // 2) Navegacion real con el navegador.
  let navOk = false;
  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
    navOk = true;
  } catch (e) {
    errors.push(`navegacion: ${redactor.text(String((e as Error).message ?? e)).slice(0, 300)}`);
  }

  // 3) Autenticacion.
  let authOutcome: AuthOutcome = 'NOT_REQUIRED';
  let authDetails: string[] = [];
  let accessibility: Accessibility = navOk ? 'ACCESIBLE' : 'ERROR';
  if (navOk) {
    const probe = await probeLoginPage(page);
    if (!probe.isLoginPage) {
      const cookies = await context.cookies(source.url);
      authOutcome = hasState && cookies.length ? 'SESSION_REUSED' : 'NOT_REQUIRED';
    } else if (probe.captcha.length) {
      authOutcome = 'BLOCKED_CAPTCHA';
      authDetails = probe.captcha;
      accessibility = 'BLOQUEADA';
    } else if (probe.mfa.length) {
      authOutcome = 'BLOCKED_MFA';
      authDetails = probe.mfa;
      accessibility = 'BLOQUEADA';
    } else {
      log(`  pagina de login detectada (${probe.reasons.join(', ')})`);
      phase = 'login';
      const result = await attemptAutoLogin(page, cfg, log);
      authOutcome = result.outcome;
      authDetails = result.details;
      if (result.outcome === 'LOGGED_IN') {
        await saveStorageState(context, cfg.storageStatePath);
        log(`  storageState guardado en ${cfg.storageStatePath}`);
        phase = 'load-after-login';
        initialHtml = '';
        try {
          await page.goto(source.url, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
          await page.waitForTimeout(2500);
          const again = await probeLoginPage(page);
          if (again.isLoginPage) {
            accessibility = 'REQUIERE_LOGIN';
            authDetails.push('tras el login la URL volvio a pedir credenciales');
          }
        } catch (e) {
          errors.push(`navegacion post-login: ${redactor.text(String((e as Error).message ?? e)).slice(0, 300)}`);
          accessibility = 'ERROR';
        }
      } else if (result.outcome === 'BLOCKED_CAPTCHA' || result.outcome === 'BLOCKED_MFA') {
        accessibility = 'BLOQUEADA';
      } else {
        accessibility = 'REQUIERE_LOGIN';
      }
    }
  }

  // 4) Hechos del DOM + scroll para disparar cargas diferidas.
  let pageFacts: PageFacts = {
    finalUrl: '',
    title: '',
    rendering: 'DESCONOCIDO',
    frameworkHints: [],
    initialHtmlBytes: 0,
    initialTextChars: 0,
    domTextChars: 0,
    tables: { count: 0, rows: [], headers: [] },
    embeddedJson: [],
    forms: { count: 0, methods: [] },
    paginationHints: [],
    iframes: [],
    links: 0,
  };
  if (navOk && accessibility === 'ACCESIBLE') {
    phase = 'scroll';
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight)).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

    if (cfg.interactiveSeconds > 0) {
      phase = 'manual';
      log(`  FASE MANUAL (${cfg.interactiveSeconds}s): navegue en el navegador (periodo, detalle, institucion, paginacion). Las peticiones JSON se listan en vivo.`);
      if (cfg.headless) log('  AVISO: MAP_RECON_HEADLESS=true; la fase manual solo es util con navegador visible.');
      const end = Date.now() + cfg.interactiveSeconds * 1000;
      while (Date.now() < end) await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    }
    pageFacts = await collectPageFacts(page, initialHtml, redactor, errors);
    phase = 'exports';
    exportsFound = await probeExportLinks(page, context, origin, redactor, log);
  }

  await Promise.allSettled(pending);

  // 5) Screenshot (puede contener datos institucionales, nunca secretos de sesion).
  try {
    if (navOk) await page.screenshot({ path: path.join(artifactsDirAbs, 'screenshot.png'), fullPage: true });
  } catch (e) {
    errors.push(`screenshot: ${redactor.text(String((e as Error).message ?? e)).slice(0, 200)}`);
  }

  const cookies = await context.cookies(source.url).catch(() => []);
  const sessionCookieNames = cookies.map((c) => c.name);
  const bearerObserved = exchanges.some((e) => Object.keys(e.requestHeaders).some((k) => k.toLowerCase() === 'authorization'));
  await context.close();

  // 6) Candidatos y ejemplos sanitizados.
  const order = { ALTA: 0, MEDIA: 1, BAJA: 2, 'N/A': 3 } as const;
  const candidates = dedupeExchanges(
    exchanges.filter((e) => (e.kind === 'JSON' || e.kind === 'GRAPHQL') && (e.utility === 'ALTA' || e.utility === 'MEDIA')),
  )
    .sort((a, b) => order[a.utility] - order[b.utility] || b.sizeBytes - a.sizeBytes)
    .slice(0, 25);
  for (const ex of candidates) {
    const parsed = parsedBodies.get(ex.id);
    if (parsed === undefined) continue;
    const pathname = (() => {
      try {
        return new URL(ex.url).pathname;
      } catch {
        return ex.path;
      }
    })();
    const file = `${String(ex.id).padStart(3, '0')}-${ex.method.toLowerCase()}-${slugify(pathname) || 'root'}.json`;
    const sample = {
      request: { method: ex.method, url: ex.url, headers: ex.requestHeaders, body: ex.requestBody ?? null },
      response: { status: ex.status, contentType: ex.contentType, headers: ex.responseHeaders, body: redactor.json(parsed) },
      shape: ex.shape,
    };
    writeFileSync(path.join(samplesDir, file), JSON.stringify(sample, null, 2), 'utf8');
    ex.sampleFile = `${artifactsDir}/samples/${file}`;
  }

  exportsFound.forEach((e, i) => {
    if (!e.sampleBody) return;
    const ext = e.kind === 'JSON' ? 'json' : e.kind === 'CSV' ? 'csv' : 'html';
    const file = `export-${String(i + 1).padStart(2, '0')}-${slugify(e.text) || 'descarga'}.${ext}`;
    writeFileSync(path.join(samplesDir, file), e.sampleBody, 'utf8');
    e.sampleFile = `${artifactsDir}/samples/${file}`;
    delete e.sampleBody;
  });

  const stats = {
    total,
    noise,
    json: exchanges.filter((e) => e.kind === 'JSON').length,
    graphql: exchanges.filter((e) => e.kind === 'GRAPHQL').length,
    html,
    xhrFetch,
    websockets,
  };

  const authSummary = ((): string => {
    switch (authOutcome) {
      case 'NOT_REQUIRED':
        return 'NO REQUERIDA (pagina accesible sin sesion)';
      case 'SESSION_REUSED':
        return `SESSION COOKIE (storageState reutilizado${bearerObserved ? ' + Bearer en peticiones' : ''})`;
      case 'LOGGED_IN':
        return `LOGIN USUARIO/PASSWORD -> ${bearerObserved ? 'token Bearer' : 'cookie de sesion'}`;
      case 'LOGIN_FAILED':
        return `LOGIN REQUERIDO - intento automatico fallido (${authDetails.join('; ')})`;
      case 'BLOCKED_CAPTCHA':
        return `CAPTCHA detectado (${authDetails.join('; ')}) - no se evade`;
      case 'BLOCKED_MFA':
        return `MFA detectado (${authDetails.join('; ')}) - no se evade`;
      case 'NO_CREDENTIALS':
        return 'LOGIN REQUERIDO - sin credenciales en .env';
      case 'AUTO_LOGIN_DISABLED':
        return 'LOGIN REQUERIDO - login automatico desactivado (use npm run recon:login)';
    }
  })();

  const partialReport: Omit<SourceReport, 'recommendation'> = {
    source,
    redactedUrl: redactor.url(source.url),
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    preflight,
    accessibility,
    auth: { outcome: authOutcome, summary: authSummary, details: authDetails, sessionCookieNames, bearerObserved },
    page: pageFacts,
    exchanges,
    stats,
    candidates,
    exports: exportsFound,
    errors,
    artifactsDir,
  };
  const report: SourceReport = { ...partialReport, recommendation: recommend(partialReport) };

  writeFileSync(path.join(artifactsDirAbs, 'requests.json'), JSON.stringify(exchanges, null, 2), 'utf8');
  const { exchanges: _omit, ...summary } = report;
  writeFileSync(path.join(artifactsDirAbs, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  return report;
}

async function main(): Promise<void> {
  const cfg = loadConfig(ROOT);
  const problems = validateSources(cfg);
  if (problems.length) {
    for (const p of problems) console.error(`ERROR: ${p}`);
    process.exit(1);
  }
  const redactor = new Redactor([cfg.username, cfg.password]);
  const log = (m: string) => console.log(redactor.text(m));

  log(`Reconocimiento MAP - ${cfg.sources.length} fuente(s), headless=${cfg.headless}, storageState=${existsSync(cfg.storageStatePath) ? 'presente' : 'ausente'}`);
  mkdirSync(cfg.outDir, { recursive: true });

  const browser = await chromium.launch({ headless: cfg.headless, channel: cfg.browserChannel });
  const reports: SourceReport[] = [];
  try {
    for (const source of cfg.sources) {
      log(`\n=== [${source.index}] ${source.name} -> ${redactor.url(source.url)}`);
      try {
        const r = await analyzeSource(browser, cfg, source, redactor, log);
        reports.push(r);
        log(`  resultado: ${r.accessibility} · JSON=${r.stats.json} GraphQL=${r.stats.graphql} tablas=${r.page.tables.count} exportaciones=${r.exports.length} · recomendado=${r.recommendation.primary} (fallback ${r.recommendation.fallback})`);
      } catch (e) {
        log(`  ERROR irrecuperable: ${String((e as Error).message ?? e)}`);
      }
    }
  } finally {
    await browser.close();
  }

  const generatedAt = new Date().toISOString();
  const reportPath = path.resolve(cfg.rootDir, process.env.MAP_RECON_REPORT?.trim() || 'docs/recon/AUTO_REPORT.md');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, renderReport(cfg, reports, generatedAt), 'utf8');
  log(`\nInforme escrito en ${reportPath}`);
  const method: Method[] = reports.map((r) => r.recommendation.primary);
  log(`Metodos recomendados: ${reports.map((r, i) => `${r.source.name}=${method[i]}`).join(' · ')}`);
}

main().catch((e) => {
  console.error('Fallo del reconocimiento:', (e as Error).message ?? e);
  process.exit(1);
});
