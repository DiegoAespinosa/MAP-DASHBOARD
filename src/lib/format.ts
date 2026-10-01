import { TIMEZONE } from '@/config';

/** "2030-08-20" -> "20/08/2030" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Fecha y hora de Santo Domingo como "dd/mm/aaaa HH:MM".
 * Se arma a partir de partes numéricas para que servidor y navegador produzcan
 * exactamente el mismo texto (los formatos localizados difieren entre entornos).
 */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = Object.fromEntries(parts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.day}/${p.month}/${p.year} ${hour}:${p.minute}`;
}

export function fmtNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/\.?0+$/, '');
}
