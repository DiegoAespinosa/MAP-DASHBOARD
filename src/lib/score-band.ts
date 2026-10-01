import { SCORE_BANDS } from '@/config';

export type ScoreBand = 'ROJO' | 'AMARILLO' | 'VERDE';

export function scoreBand(score: number | null | undefined): ScoreBand | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  if (score < SCORE_BANDS.low) return 'ROJO';
  if (score <= SCORE_BANDS.high) return 'AMARILLO';
  return 'VERDE';
}

/** Clases de texto y de barra por banda (misma paleta que el semáforo). */
export const SCORE_BAND_CLASS: Record<ScoreBand, { text: string; bar: string; label: string }> = {
  ROJO: { text: 'text-sem-vencido-ink', bar: 'bg-sem-vencido-dot', label: 'Rojo' },
  AMARILLO: { text: 'text-sem-atencion-ink', bar: 'bg-sem-atencion-dot', label: 'Amarillo' },
  VERDE: { text: 'text-sem-normal-ink', bar: 'bg-sem-normal-dot', label: 'Verde' },
};
