/**
 * Redaccion de secretos para todo lo que se escribe a disco o consola.
 * Regla: nunca aparecen passwords, tokens completos, cookies de sesion ni
 * cabeceras Authorization completas.
 */

const SENSITIVE_KEY =
  /(pass(word)?|pwd|secret|token|auth|session|sess(id)?|cookie|jwt|api[-_]?key|csrf|xsrf|credential|clave|contrase|bearer|refresh|access[-_]?key|private)/i;

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-xsrf-token',
]);

const JWT_RE = /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;
const BEARER_RE = /(bearer\s+)([A-Za-z0-9._\-+/=]{6,})/gi;
const LONG_HEX_RE = /\b[a-f0-9]{40,}\b/gi;

export const MAX_STRING = 300;
export const MAX_ARRAY_ITEMS = 3;
export const MAX_DEPTH = 8;

export function partial(value: string): string {
  const v = String(value);
  return v.length > 12 ? `${v.slice(0, 8)}...REDACTED` : 'REDACTED';
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export class Redactor {
  private readonly literals: string[];

  /** `literals`: valores concretos (usuario, password, ...) que jamas deben aparecer. */
  constructor(literals: Array<string | undefined>) {
    this.literals = literals
      .filter((l): l is string => typeof l === 'string' && l.trim().length >= 3)
      .sort((a, b) => b.length - a.length);
  }

  text(input: string): string {
    let out = input;
    for (const lit of this.literals) out = out.split(lit).join('[REDACTED]');
    out = out.replace(BEARER_RE, (_m, p: string) => `${p}...REDACTED`);
    out = out.replace(JWT_RE, (m) => partial(m));
    out = out.replace(LONG_HEX_RE, (m) => partial(m));
    return out;
  }

  url(raw: string): string {
    try {
      const u = new URL(raw);
      for (const [k, v] of Array.from(u.searchParams.entries())) {
        if (SENSITIVE_KEY.test(k)) u.searchParams.set(k, 'REDACTED');
        else u.searchParams.set(k, this.text(v));
      }
      if (u.username || u.password) {
        u.username = 'REDACTED';
        u.password = '';
      }
      return this.text(u.toString());
    } catch {
      return this.text(raw);
    }
  }

  headers(headers: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase();
      if (lower === 'cookie') {
        const names = value
          .split(';')
          .map((c) => c.split('=')[0].trim())
          .filter(Boolean);
        out[name] = `REDACTED (${names.length} cookies: ${names.join(', ')})`;
      } else if (lower === 'set-cookie') {
        const cookieName = value.split('=')[0].trim();
        const flags = value
          .split(';')
          .slice(1)
          .map((f) => f.trim())
          .filter((f) => /^(httponly|secure|samesite|path|domain)/i.test(f));
        out[name] = `${cookieName}=REDACTED; ${flags.join('; ')}`;
      } else if (SENSITIVE_HEADERS.has(lower) || SENSITIVE_KEY.test(lower)) {
        out[name] = partial(value);
      } else {
        out[name] = this.text(value);
      }
    }
    return out;
  }

  /** Redacta y trunca un valor JSON (claves sensibles, strings largos, arrays). */
  json(value: unknown, depth = 0): unknown {
    if (depth > MAX_DEPTH) return '[...profundidad maxima]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      const t = this.text(value);
      return t.length > MAX_STRING ? `${t.slice(0, MAX_STRING)}...(+${t.length - MAX_STRING})` : t;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => this.json(v, depth + 1));
      if (value.length > MAX_ARRAY_ITEMS) items.push(`...(+${value.length - MAX_ARRAY_ITEMS} elementos omitidos)`);
      return items;
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const scalar = typeof v === 'string' || typeof v === 'number';
        out[k] = SENSITIVE_KEY.test(k) && scalar ? 'REDACTED' : this.json(v, depth + 1);
      }
      return out;
    }
    return String(value);
  }
}
