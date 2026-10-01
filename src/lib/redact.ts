/** Redacción de secretos en mensajes de error y logs. */
const JWT_RE = /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;
const BEARER_RE = /(bearer\s+)[A-Za-z0-9._\-+/=]{6,}/gi;
const COOKIE_RE = /((?:\.ASPXAUTH|ASP\.NET_SessionId|__RequestVerificationToken[^=\s]*)=)[^;\s]+/gi;

export function redactText(input: string): string {
  let out = input;
  for (const literal of [process.env.MAP_PASSWORD, process.env.MAP_USERNAME]) {
    if (literal && literal.length >= 3) out = out.split(literal).join('[REDACTED]');
  }
  return out.replace(BEARER_RE, '$1[REDACTED]').replace(JWT_RE, '[REDACTED]').replace(COOKIE_RE, '$1[REDACTED]');
}
