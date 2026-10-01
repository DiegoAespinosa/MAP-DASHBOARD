/**
 * Clasificacion de intercambios de red capturados durante el reconocimiento.
 * Nada aqui asume nombres de endpoints del MAP: las palabras clave son pistas.
 */

export type Kind = 'JSON' | 'GRAPHQL' | 'HTML' | 'JS' | 'CSS' | 'XML' | 'TEXT' | 'BINARY' | 'OTHER';
export type Utility = 'ALTA' | 'MEDIA' | 'BAJA' | 'N/A';

export interface FieldInfo {
  name: string;
  type: string;
}

export interface JsonShape {
  rootType: 'array' | 'object' | 'scalar';
  /** Ruta (punto-separada) del array principal de registros; "" = raiz. */
  mainArrayPath: string;
  recordCount: number;
  fields: FieldInfo[];
  paginationKeys: string[];
}

export interface CapturedExchange {
  id: number;
  phase: string;
  tSec: number;
  method: string;
  url: string;
  path: string;
  sameOrigin: boolean;
  resourceType: string;
  status: number;
  contentType: string;
  kind: Kind;
  sizeBytes: number;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  responseHeaders: Record<string, string>;
  hints: string[];
  shape?: JsonShape;
  graphqlOperation?: string;
  utility: Utility;
  sampleFile?: string;
  noise: boolean;
  isNavigation: boolean;
  /** Rellenado al deduplicar candidatos: veces observado y fases en que aparecio. */
  seenCount?: number;
  phases?: string[];
}

/** Pistas de la especificacion. Solo orientan la puntuacion; no se asumen. */
export const KEYWORD_HINTS = [
  'api',
  'indicator',
  'indicador',
  'evaluacion',
  'evaluation',
  'score',
  'result',
  'resultado',
  'institution',
  'institucion',
  'dashboard',
  'data',
  'metrics',
  'detail',
  'list',
  'search',
  'query',
  'graphql',
];

const NOISE_HOSTS =
  /(google-analytics|googletagmanager|doubleclick|facebook\.net|hotjar|clarity\.ms|sentry\.io|newrelic|nr-data|datadoghq|segment\.io|mixpanel|fonts\.g(oogleapis|static)\.com|gstatic\.com\/recaptcha|cdn\.jsdelivr|cdnjs|unpkg\.com|bootstrapcdn)/i;

const LOW_VALUE_PATH =
  /(i18n|locale|translation|lang\b|manifest\.json|version|health|ping|profile|\/me\b|menu|permission|notification|telemetry|analytics|sw\.js|favicon|\.map$)/i;

const PAGINATION_KEYS = new Set([
  'page',
  'pagina',
  'pageSize',
  'page_size',
  'per_page',
  'perPage',
  'limit',
  'offset',
  'skip',
  'take',
  'total',
  'totalCount',
  'total_count',
  'totalPages',
  'total_pages',
  'count',
  'next',
  'nextPage',
  'hasMore',
  'has_more',
  'cursor',
  'size',
  'number',
  'totalElements',
  'last',
  'first',
  'recordsTotal',
  'recordsFiltered',
]);

const PREFERRED_ARRAY_KEYS = ['data', 'items', 'results', 'rows', 'content', 'records', 'lista', 'datos', 'result', 'value', 'list', 'hits'];

export function isNoise(url: string): boolean {
  return NOISE_HOSTS.test(url);
}

export function findHints(url: string): string[] {
  const lower = url.toLowerCase();
  return KEYWORD_HINTS.filter((k) => lower.includes(k));
}

export function looksLikeJsonText(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

export function tryParseJson(text: string): unknown | undefined {
  if (!looksLikeJsonText(text)) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function detectKind(opts: { contentType: string; url: string; method: string; postData?: string | null; bodyText?: string }): Kind {
  const ct = opts.contentType.toLowerCase();
  const path = safePath(opts.url).toLowerCase();

  if (ct.includes('application/graphql') || /\/graphql(\b|\/|$)/.test(path)) return 'GRAPHQL';
  if (opts.method === 'POST' && opts.postData && looksLikeJsonText(opts.postData)) {
    try {
      const body = JSON.parse(opts.postData) as Record<string, unknown> | Array<Record<string, unknown>>;
      const first = Array.isArray(body) ? body[0] : body;
      if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).query === 'string') {
        const q = (first as Record<string, unknown>).query as string;
        if (/^\s*(query|mutation|subscription|\{)/.test(q)) return 'GRAPHQL';
      }
    } catch {
      /* no es JSON valido */
    }
  }
  if (ct.includes('json')) return 'JSON';
  if (ct.includes('text/html')) return 'HTML';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'JS';
  if (ct.includes('text/css')) return 'CSS';
  if (ct.includes('xml')) return 'XML';
  if (ct.includes('image/') || ct.includes('font/') || ct.includes('octet-stream') || ct.includes('pdf')) return 'BINARY';
  if (opts.bodyText !== undefined && tryParseJson(opts.bodyText) !== undefined) return 'JSON';
  if (ct.startsWith('text/')) return 'TEXT';
  return 'OTHER';
}

export function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search ? u.search : '');
  } catch {
    return url;
  }
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(v)) return 'string(fecha ISO)';
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(v)) return 'string(fecha dd/mm/aaaa)';
    if (/^-?\d+([.,]\d+)?$/.test(v)) return 'string(numerico)';
    return 'string';
  }
  return typeof v;
}

interface ArrayCandidate {
  path: string;
  items: unknown[];
}

function findArrays(value: unknown, path: string, depth: number, out: ArrayCandidate[]): void {
  if (depth > 4 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    if (value.some((v) => v && typeof v === 'object' && !Array.isArray(v))) out.push({ path, items: value });
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    findArrays(v, path ? `${path}.${k}` : k, depth + 1, out);
  }
}

export function inferShape(json: unknown): JsonShape {
  const rootType: JsonShape['rootType'] = Array.isArray(json) ? 'array' : json && typeof json === 'object' ? 'object' : 'scalar';
  const arrays: ArrayCandidate[] = [];
  findArrays(json, '', 0, arrays);

  arrays.sort((a, b) => {
    const pa = PREFERRED_ARRAY_KEYS.includes(a.path.split('.').pop() ?? '') ? 1 : 0;
    const pb = PREFERRED_ARRAY_KEYS.includes(b.path.split('.').pop() ?? '') ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return b.items.length - a.items.length;
  });

  const main = arrays[0];
  const fieldMap = new Map<string, string>();
  const sampleItems = main ? main.items.slice(0, 20) : rootType === 'object' ? [json] : [];
  for (const item of sampleItems) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (!fieldMap.has(k)) fieldMap.set(k, typeOf(v));
    }
  }

  const paginationKeys: string[] = [];
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    for (const k of Object.keys(json as Record<string, unknown>)) if (PAGINATION_KEYS.has(k)) paginationKeys.push(k);
    const meta = (json as Record<string, unknown>).meta ?? (json as Record<string, unknown>).pagination;
    if (meta && typeof meta === 'object') {
      for (const k of Object.keys(meta as Record<string, unknown>)) if (PAGINATION_KEYS.has(k)) paginationKeys.push(`meta.${k}`);
    }
  }

  return {
    rootType,
    mainArrayPath: main ? main.path : '',
    recordCount: main ? main.items.length : 0,
    fields: Array.from(fieldMap, ([name, type]) => ({ name, type })).slice(0, 60),
    paginationKeys,
  };
}

export function detectQueryPagination(url: string): string[] {
  try {
    const u = new URL(url);
    return Array.from(u.searchParams.keys()).filter((k) => PAGINATION_KEYS.has(k) || /^(p|pg|start|draw|length)$/i.test(k));
  } catch {
    return [];
  }
}

export function scoreUtility(ex: Pick<CapturedExchange, 'kind' | 'status' | 'url' | 'hints' | 'shape' | 'sizeBytes' | 'sameOrigin'>): Utility {
  if (ex.kind !== 'JSON' && ex.kind !== 'GRAPHQL') return 'N/A';
  if (ex.status < 200 || ex.status >= 300) return 'BAJA';
  let score = 3;
  if (ex.shape && ex.shape.recordCount >= 3 && ex.shape.fields.length >= 3) score += 2;
  if (ex.shape && ex.shape.fields.length >= 5) score += 1;
  if (!ex.shape || ex.shape.recordCount === 0) score -= 1;
  if (ex.sizeBytes < 512) score -= 1;
  if (ex.hints.length > 0) score += 2;
  if (ex.sizeBytes > 2048) score += 1;
  if (!ex.sameOrigin) score -= 1;
  if (LOW_VALUE_PATH.test(safePath(ex.url))) score -= 3;
  if (score >= 7) return 'ALTA';
  if (score >= 4) return 'MEDIA';
  return 'BAJA';
}

/** Agrupa por metodo+ruta (con query) conservando el primero; anota repeticiones y fases. */
export function dedupeExchanges(list: CapturedExchange[]): CapturedExchange[] {
  const byKey = new Map<string, CapturedExchange>();
  for (const ex of list) {
    const key = `${ex.method} ${ex.path}${ex.graphqlOperation ? ` ${ex.graphqlOperation}` : ''}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...ex, seenCount: 1, phases: [ex.phase] });
    } else {
      seen.seenCount = (seen.seenCount ?? 1) + 1;
      if (!seen.phases?.includes(ex.phase)) seen.phases?.push(ex.phase);
      if (!seen.shape && ex.shape) seen.shape = ex.shape;
    }
  }
  return Array.from(byKey.values());
}

export function graphqlOperationName(postData?: string | null): string | undefined {
  if (!postData) return undefined;
  try {
    const body = JSON.parse(postData) as Record<string, unknown> | Array<Record<string, unknown>>;
    const first = Array.isArray(body) ? body[0] : body;
    if (!first || typeof first !== 'object') return undefined;
    if (typeof first.operationName === 'string') return first.operationName;
    const q = typeof first.query === 'string' ? first.query : '';
    const m = q.match(/^\s*(query|mutation|subscription)\s+([A-Za-z0-9_]+)/);
    return m ? `${m[1]} ${m[2]}` : q ? 'anonima' : undefined;
  } catch {
    return undefined;
  }
}
