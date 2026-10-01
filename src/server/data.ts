import { prisma } from '@/server/db';
import { semaphoreFor, type Semaphore } from '@/lib/semaphore';
import { daysBetween, todayDateUTC } from '@/server/sismap/values';

export interface BoardEvidence {
  id: string;
  code: string;
  name: string;
  dueDate: string | null;
  verifiedBy: string | null;
  value: number | null;
  status: string | null;
  overdue: boolean;
  missing: boolean;
}

export interface BoardIndicator {
  id: string;
  sourceId: string;
  sourceName: string;
  code: string;
  name: string;
  section: string | null;
  score: number | null;
  weight: number | null;
  weightedResult: number | null;
  color: string | null;
  status: string | null;
  deadline: string | null;
  daysRemaining: number | null;
  semaphore: Semaphore;
  evidencesTotal: number;
  evidencesOverdue: number;
  evidences: BoardEvidence[];
  responsible: string;
  contact: string;
  missing: boolean;
}

export interface BoardSource {
  id: string;
  name: string;
  url: string;
  kind: 'CARGA_EVIDENCIA' | 'RANKING';
  lastRefreshAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastOverallScore: number | null;
  indicatorCount: number;
}

export interface Board {
  generatedAt: string;
  lastRefresh: { id: string; status: string; startedAt: string; finishedAt: string | null; error: string | null; progress: unknown; summary: unknown } | null;
  sources: BoardSource[];
  indicators: BoardIndicator[];
  totals: Record<Semaphore, number> & { total: number };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export async function getBoard(): Promise<Board> {
  const today = todayDateUTC();
  const [sources, indicators, lastRefresh] = await Promise.all([
    prisma.source.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { indicators: { where: { missingSince: null } } } } } }),
    prisma.indicator.findMany({
      where: { source: { enabled: true } },
      include: { source: true, internal: true, evidences: { orderBy: { code: 'asc' } } },
      orderBy: [{ source: { sortOrder: 'asc' } }, { code: 'asc' }],
    }),
    prisma.refresh.findFirst({ orderBy: { startedAt: 'desc' } }),
  ]);

  const board: BoardIndicator[] = indicators.map((i) => {
    const daysRemaining = i.deadline ? daysBetween(today, i.deadline) : null;
    const evidences: BoardEvidence[] = i.evidences.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      dueDate: isoDate(e.dueDate),
      verifiedBy: e.verifiedBy,
      value: e.value,
      status: e.status,
      overdue: !!e.dueDate && e.dueDate.getTime() < today.getTime(),
      missing: !!e.missingSince,
    }));
    const live = evidences.filter((e) => !e.missing);
    return {
      id: i.id,
      sourceId: i.sourceId,
      sourceName: i.source.name,
      code: i.code,
      name: i.name,
      section: i.section,
      score: i.score,
      weight: i.weight,
      weightedResult: i.weightedResult,
      color: i.color,
      status: i.status,
      deadline: isoDate(i.deadline),
      daysRemaining,
      semaphore: semaphoreFor(daysRemaining),
      evidencesTotal: live.length,
      evidencesOverdue: live.filter((e) => e.overdue).length,
      evidences,
      responsible: i.internal?.responsible ?? '',
      contact: i.internal?.contact ?? '',
      missing: !!i.missingSince,
    };
  });

  const totals = { VENCIDO: 0, CRITICO: 0, ATENCION: 0, PROXIMO: 0, NORMAL: 0, SIN_FECHA: 0, total: 0 };
  for (const i of board) {
    if (i.missing) continue;
    totals[i.semaphore]++;
    totals.total++;
  }

  return {
    generatedAt: new Date().toISOString(),
    lastRefresh: lastRefresh
      ? { id: lastRefresh.id, status: lastRefresh.status, startedAt: lastRefresh.startedAt.toISOString(), finishedAt: iso(lastRefresh.finishedAt), error: lastRefresh.error, progress: lastRefresh.progress, summary: lastRefresh.summary }
      : null,
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      kind: s.kind,
      lastRefreshAt: iso(s.lastRefreshAt),
      lastStatus: s.lastStatus,
      lastError: s.lastError,
      lastOverallScore: s.lastOverallScore,
      indicatorCount: s._count.indicators,
    })),
    indicators: board,
    totals,
  };
}
