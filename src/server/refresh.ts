/**
 * Actualización desde SISMAP: descarga las fuentes, valida, compara y guarda.
 * Una sola actualización a la vez. Una fuente que falla no borra sus datos anteriores.
 */
import { ANOMALY_MIN_PERCENT, REFRESH_STALE_MINUTES } from '@/config';
import { prisma } from '@/server/db';
import type { Prisma, Source } from '@/generated/prisma/client';
import { mergeExportAndPage, deriveDeadline } from '@/server/sismap/merge';
import { RANKING_INDEX_LABELS, parseIndicatorExport, parseRankingExport, rankingCodeFromLabel } from '@/server/sismap/parse-export';
import { parseCargaEvidenciaPage, parseRankingPage } from '@/server/sismap/parse-page';
import { openSismapSession, type SismapSession } from '@/server/sismap/session';
import type { ParsedIndicator } from '@/server/sismap/types';
import { redactText } from '@/lib/redact';

export interface RefreshProgress {
  index: number;
  total: number;
  sourceName: string;
  stage: 'CONECTANDO' | 'AUTENTICANDO' | 'DESCARGANDO' | 'VALIDANDO' | 'GUARDANDO' | 'FINALIZADO';
}

export interface SourceResult {
  sourceId: string;
  sourceName: string;
  status: 'OK' | 'FAILED' | 'ANOMALY';
  indicators: number;
  evidences: number;
  created: number;
  updated: number;
  missing: number;
  overallScore: number | null;
  warnings: string[];
  error?: string;
}

export interface RefreshResult {
  refreshId: string;
  status: 'OK' | 'PARTIAL' | 'FAILED';
  dryRun: boolean;
  sources: SourceResult[];
}

export class RefreshAlreadyRunning extends Error {
  constructor() {
    super('Ya hay una actualización en curso.');
    this.name = 'RefreshAlreadyRunning';
  }
}

type Log = (m: string) => void;

/** Serializa a JSON plano (fechas como texto) para columnas Json de Prisma. */
const toJson = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export interface RunRefreshOptions {
  dryRun?: boolean;
  log?: Log;
  onProgress?: (p: RefreshProgress) => void;
  /** Para pruebas: sustituye la sesión real de SISMAP. */
  openSession?: (loginUrl: string, log: Log) => Promise<SismapSession>;
  /** Fila Refresh ya creada (RUNNING) por quien lanza la actualización; si no, se crea aquí. */
  refreshId?: string;
}

export async function runRefresh(opts: RunRefreshOptions = {}): Promise<RefreshResult> {
  const log: Log = (m) => opts.log?.(redactText(m));
  const dryRun = opts.dryRun ?? process.env.SYNC_MODE === 'DRY_RUN';

  await failStaleRefreshes();
  const running = await prisma.refresh.findFirst({ where: { status: 'RUNNING', NOT: opts.refreshId ? { id: opts.refreshId } : undefined } });
  if (running) throw new RefreshAlreadyRunning();

  const refresh = opts.refreshId
    ? await prisma.refresh.update({ where: { id: opts.refreshId }, data: { status: 'RUNNING', progress: { stage: 'CONECTANDO' }, heartbeat: new Date() } })
    : await prisma.refresh.create({ data: { status: 'RUNNING', progress: { stage: 'CONECTANDO' } } });
  const sources = await prisma.source.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } });
  const results: SourceResult[] = [];
  let session: SismapSession | null = null;

  const progress = async (p: RefreshProgress) => {
    opts.onProgress?.(p);
    await prisma.refresh.update({ where: { id: refresh.id }, data: { progress: toJson(p), heartbeat: new Date() } });
  };

  try {
    if (sources.length) {
      await progress({ index: 0, total: sources.length, sourceName: sources[0].name, stage: 'AUTENTICANDO' });
      const loginUrl = process.env.MAP_LOGIN_URL || '';
      session = opts.openSession ? await opts.openSession(loginUrl, log) : await openSismapSession({ loginUrl: loginUrl || undefined, log });
    }
    for (const [i, source] of sources.entries()) {
      const base = { index: i + 1, total: sources.length, sourceName: source.name };
      await progress({ ...base, stage: 'DESCARGANDO' });
      try {
        const extracted = await extractSource(session!, source, log);
        await progress({ ...base, stage: 'VALIDANDO' });
        const anomaly = detectAnomaly(source, extracted.indicators.length);
        if (anomaly) {
          results.push({ ...emptyResult(source), status: 'ANOMALY', indicators: extracted.indicators.length, error: anomaly, warnings: extracted.warnings });
          if (!dryRun) await prisma.source.update({ where: { id: source.id }, data: { lastStatus: 'ANOMALY', lastError: anomaly, lastRefreshAt: new Date() } });
          log(`${source.name}: ${anomaly}`);
          continue;
        }
        await progress({ ...base, stage: 'GUARDANDO' });
        const saved = dryRun ? previewSave(source, extracted.indicators) : await saveSource(source, extracted.indicators, extracted.overallScore);
        results.push({ ...saved, sourceName: source.name, warnings: extracted.warnings, overallScore: extracted.overallScore });
        log(`${source.name}: ${saved.indicators} indicadores, ${saved.evidences} evidencias (${saved.created} nuevos, ${saved.updated} actualizados, ${saved.missing} ausentes)`);
      } catch (e) {
        const message = redactText(String((e as Error).message ?? e)).slice(0, 500);
        results.push({ ...emptyResult(source), status: 'FAILED', error: message });
        if (!dryRun) await prisma.source.update({ where: { id: source.id }, data: { lastStatus: 'FAILED', lastError: message, lastRefreshAt: new Date() } });
        log(`${source.name}: ERROR ${message}`);
      }
    }
  } finally {
    await session?.close();
  }

  const ok = results.filter((r) => r.status === 'OK').length;
  const status: RefreshResult['status'] = ok === results.length && results.length > 0 ? 'OK' : ok > 0 ? 'PARTIAL' : 'FAILED';
  const snapshot = dryRun ? null : await buildSnapshot();
  await prisma.refresh.update({
    where: { id: refresh.id },
    data: {
      status,
      finishedAt: new Date(),
      progress: { stage: 'FINALIZADO', index: sources.length, total: sources.length, sourceName: '' },
      summary: toJson({ dryRun, sources: results }),
      snapshot: snapshot ? toJson(snapshot) : undefined,
      error: status === 'FAILED' ? results.map((r) => r.error).filter(Boolean).join(' | ').slice(0, 1000) : null,
    },
  });
  return { refreshId: refresh.id, status, dryRun, sources: results };
}

async function failStaleRefreshes(): Promise<void> {
  const limit = new Date(Date.now() - REFRESH_STALE_MINUTES * 60_000);
  await prisma.refresh.updateMany({
    where: { status: 'RUNNING', heartbeat: { lt: limit } },
    data: { status: 'FAILED', finishedAt: new Date(), error: `Sin actividad durante ${REFRESH_STALE_MINUTES} minutos; se dio por abandonada.` },
  });
}

async function extractSource(session: SismapSession, source: Source, log: Log): Promise<{ indicators: ParsedIndicator[]; overallScore: number | null; warnings: string[] }> {
  if (source.kind === 'RANKING') {
    try {
      const ranking = parseRankingExport(await session.fetchText(source.exportUrl));
      return { indicators: ranking.indicators.map(toIndicator), overallScore: null, warnings: [] };
    } catch (e) {
      log(`${source.name}: exportación no disponible (${(e as Error).message}); se usa la tabla de la página`);
      const page = parseRankingPage(await session.fetchText(source.url));
      const indicators = Object.entries(page.values).flatMap(([label, score]) => {
        const code = rankingCodeFromLabel(label);
        if (!code) return [];
        return [toIndicator({ code, name: RANKING_INDEX_LABELS[code] ?? label, score, weight: null, weightedResult: null })];
      });
      return { indicators, overallScore: null, warnings: ['Datos tomados de la página porque la exportación falló.'] };
    }
  }
  const warnings: string[] = [];
  let exportRows: ReturnType<typeof parseIndicatorExport> = [];
  try {
    exportRows = parseIndicatorExport(await session.fetchText(source.exportUrl));
  } catch (e) {
    warnings.push(`Exportación no disponible (${(e as Error).message}); puntuaciones tomadas de la página.`);
  }
  const page = parseCargaEvidenciaPage(await session.fetchText(source.url));
  const merged = mergeExportAndPage(exportRows, page);
  return { indicators: merged.indicators, overallScore: page.overallScore, warnings: [...warnings, ...merged.warnings] };
}

function toIndicator(row: { code: string; name: string; score: number | null; weight: number | null; weightedResult: number | null }): ParsedIndicator {
  return { ...row, section: null, color: null, status: row.score === null ? 'SIN_DATO' : null, subIndicadorId: null, evidences: [] };
}

function detectAnomaly(source: Source, count: number): string | null {
  const previous = source.lastRecordCount ?? 0;
  if (count === 0) return previous > 0 ? `La fuente devolvió 0 indicadores (antes ${previous}); no se reemplazan los datos.` : 'La fuente devolvió 0 indicadores.';
  if (previous > 0 && count * 100 < previous * ANOMALY_MIN_PERCENT) {
    return `La fuente devolvió ${count} indicadores frente a ${previous} anteriores (caída > ${100 - ANOMALY_MIN_PERCENT} %); no se reemplazan los datos.`;
  }
  return null;
}

function emptyResult(source: Source): SourceResult {
  return { sourceId: source.id, sourceName: source.name, status: 'OK', indicators: 0, evidences: 0, created: 0, updated: 0, missing: 0, overallScore: null, warnings: [] };
}

function previewSave(source: Source, indicators: ParsedIndicator[]): SourceResult {
  return { ...emptyResult(source), indicators: indicators.length, evidences: indicators.reduce((n, i) => n + i.evidences.length, 0) };
}

async function saveSource(source: Source, indicators: ParsedIndicator[], overallScore: number | null): Promise<SourceResult> {
  const now = new Date();
  const result = { ...emptyResult(source), indicators: indicators.length, overallScore };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.indicator.findMany({ where: { sourceId: source.id }, select: { id: true, code: true } });
    const existingByCode = new Map(existing.map((e) => [e.code, e.id]));
    const seenCodes = new Set<string>();

    for (const ind of indicators) {
      seenCodes.add(ind.code);
      const { deadline, overdue } = deriveDeadline(ind.evidences);
      const data = {
        name: ind.name,
        section: ind.section,
        score: ind.score,
        weight: ind.weight,
        weightedResult: ind.weightedResult,
        color: ind.color,
        status: ind.status,
        deadline,
        deadlineOverdue: overdue,
        lastSeenAt: now,
        missingSince: null,
      };
      const id = existingByCode.get(ind.code);
      let indicatorId: string;
      if (id) {
        await tx.indicator.update({ where: { id }, data });
        indicatorId = id;
        result.updated++;
      } else {
        const created = await tx.indicator.create({ data: { ...data, sourceId: source.id, code: ind.code } });
        indicatorId = created.id;
        result.created++;
      }

      const seenEvidence = new Set<string>();
      for (const ev of ind.evidences) {
        seenEvidence.add(ev.code);
        const evData = { name: ev.name, dueDate: ev.dueDate, verifiedBy: ev.verifiedBy, value: ev.value, status: ev.status, externalRef: ev.externalRef, lastSeenAt: now, missingSince: null };
        await tx.evidence.upsert({
          where: { indicatorId_code: { indicatorId, code: ev.code } },
          update: evData,
          create: { ...evData, indicatorId, code: ev.code },
        });
        result.evidences++;
      }
      if (ind.evidences.length) {
        await tx.evidence.updateMany({ where: { indicatorId, code: { notIn: Array.from(seenEvidence) }, missingSince: null }, data: { missingSince: now } });
      }
    }

    const missing = existing.filter((e) => !seenCodes.has(e.code)).map((e) => e.id);
    if (missing.length) {
      await tx.indicator.updateMany({ where: { id: { in: missing }, missingSince: null }, data: { missingSince: now } });
    }
    result.missing = missing.length;

    await tx.source.update({
      where: { id: source.id },
      data: { lastRefreshAt: now, lastStatus: 'OK', lastError: null, lastOverallScore: overallScore, lastRecordCount: indicators.length },
    });
  });
  return result;
}

async function buildSnapshot(): Promise<unknown> {
  const indicators = await prisma.indicator.findMany({
    where: { missingSince: null },
    select: { sourceId: true, code: true, name: true, score: true, weight: true, weightedResult: true, color: true, status: true, deadline: true, evidences: { where: { missingSince: null }, select: { code: true, dueDate: true, value: true, status: true } } },
  });
  return indicators;
}
