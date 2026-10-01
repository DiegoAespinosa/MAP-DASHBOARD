import type { ExportRow, ParsedIndicator, ParsedPage } from './types';
import { todayDateUTC } from './values';

/** Une la exportación (puntuaciones estables) con la página (sección, color, estado, evidencias). */
export function mergeExportAndPage(exportRows: ExportRow[], page: ParsedPage): { indicators: ParsedIndicator[]; warnings: string[] } {
  const warnings: string[] = [];
  const byCode = new Map<string, ParsedIndicator>();
  for (const ind of page.indicators) byCode.set(ind.code, { ...ind, evidences: [...ind.evidences] });

  for (const row of exportRows) {
    const existing = byCode.get(row.code);
    if (existing) {
      if (existing.score !== null && row.score !== null && Math.abs(existing.score - row.score) > 0.001) {
        warnings.push(`${row.code}: la página muestra ${existing.score} puntos y la exportación ${row.score}; se usa la exportación.`);
      }
      existing.score = row.score ?? existing.score;
      existing.weight = row.weight ?? existing.weight;
      existing.weightedResult = row.weightedResult ?? existing.weightedResult;
      if (!existing.name) existing.name = row.name;
    } else {
      warnings.push(`${row.code}: aparece en la exportación pero no en la página.`);
      byCode.set(row.code, {
        code: row.code,
        name: row.name,
        section: null,
        score: row.score,
        weight: row.weight,
        weightedResult: row.weightedResult,
        color: null,
        status: null,
        subIndicadorId: null,
        evidences: [],
      });
    }
  }
  return { indicators: Array.from(byCode.values()), warnings };
}

/** Próximo vencimiento: la menor fecha futura de sus evidencias; si todas pasaron, la más reciente (vencida). */
export function deriveDeadline(evidences: Array<{ dueDate: Date | null }>, today = todayDateUTC()): { deadline: Date | null; overdue: boolean } {
  const dates = evidences.map((e) => e.dueDate).filter((d): d is Date => d instanceof Date);
  if (!dates.length) return { deadline: null, overdue: false };
  const future = dates.filter((d) => d.getTime() >= today.getTime()).sort((a, b) => a.getTime() - b.getTime());
  if (future.length) return { deadline: future[0], overdue: false };
  const past = dates.sort((a, b) => b.getTime() - a.getTime());
  return { deadline: past[0], overdue: true };
}
