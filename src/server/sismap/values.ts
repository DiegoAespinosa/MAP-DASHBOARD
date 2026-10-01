/** Conversión de valores tal como aparecen en SISMAP. */

const DATE_DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function cleanText(s: string | undefined | null): string {
  return (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** "4.57", "100", "-1.000000", "83.7 %" -> número; vacío o no numérico -> null. */
export function parseNumber(s: string | undefined | null): number | null {
  const t = cleanText(s).replace('%', '').replace(',', '.').trim();
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Puntuación 0-100; -1 (sin dato en el ranking) -> null. */
export function parseScore(s: string | undefined | null): number | null {
  const n = parseNumber(s);
  if (n === null || n < 0 || n > 100) return null;
  return n;
}

/** "20/08/2030" -> Date UTC (solo fecha). Fuera de 2000-2100 o inválida -> null. */
export function parseDateDMY(s: string | undefined | null): Date | null {
  const m = DATE_DMY.exec(cleanText(s));
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) return null;
  return d;
}

export function isDateDMY(s: string | undefined | null): boolean {
  return DATE_DMY.test(cleanText(s));
}

/** "01.1 Autoevaluación CAF" / "Pt 01.1 Arquitectura..." -> { code, name }. */
export function splitCodeAndName(text: string): { code: string; name: string } | null {
  const t = cleanText(text);
  const m = /^((?:Pt\s*)?\d{1,3}(?:\.\d{1,3})+)\s+(.+)$/i.exec(t);
  if (!m) return null;
  return { code: normalizeCode(m[1]), name: cleanText(m[2]) };
}

export function normalizeCode(code: string): string {
  return cleanText(code).replace(/^pt\s*/i, 'Pt ');
}

/** Fecha de hoy como Date UTC sin hora, en la zona de Santo Domingo. */
export function todayDateUTC(now = new Date()): Date {
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santo_Domingo' }));
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Color del semáforo de SISMAP: viene en img[alt] (VERDE_OSCURO) o solo en el nombre del archivo (Rojo.png). */
export function normalizeColor(alt: string | undefined, src: string | undefined): string | null {
  const fromAlt = cleanText(alt);
  const fromSrc = cleanText(src).split('/').pop()?.replace(/\.[a-z0-9]+$/i, '') ?? '';
  const raw = fromAlt || fromSrc;
  if (!raw) return null;
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s-]+/g, '_');
}
