'use client';

import Image from 'next/image';
import { Fragment, useMemo, useState } from 'react';
import { EditableCell } from '@/components/editable-cell';
import { IconAlert, IconChevron, IconDownload, IconSearch } from '@/components/icons';
import { RefreshButton } from '@/components/refresh-button';
import { fmtDate, fmtDateTime, fmtNumber } from '@/lib/format';
import { SEMAPHORE_LABEL, SEMAPHORE_ORDER, type Semaphore } from '@/lib/semaphore';
import type { Board, BoardIndicator, BoardSource } from '@/server/data';

const SEM_CLASS: Record<Semaphore, { chip: string; dot: string }> = {
  VENCIDO: { chip: 'bg-sem-vencido-bg text-sem-vencido-ink', dot: 'bg-sem-vencido-dot' },
  CRITICO: { chip: 'bg-sem-critico-bg text-sem-critico-ink', dot: 'bg-sem-critico-dot' },
  ATENCION: { chip: 'bg-sem-atencion-bg text-sem-atencion-ink', dot: 'bg-sem-atencion-dot' },
  PROXIMO: { chip: 'bg-sem-proximo-bg text-sem-proximo-ink', dot: 'bg-sem-proximo-dot' },
  NORMAL: { chip: 'bg-sem-normal-bg text-sem-normal-ink', dot: 'bg-sem-normal-dot' },
  SIN_FECHA: { chip: 'bg-sem-sinfecha-bg text-sem-sinfecha-ink', dot: 'bg-sem-sinfecha-dot' },
};

const COLOR_META: Record<string, { cls: string; label: string }> = {
  VERDE_OSCURO: { cls: 'bg-sem-normal-dot', label: 'Verde oscuro' },
  VERDE: { cls: 'bg-sem-normal-dot/70', label: 'Verde' },
  AMARILLO: { cls: 'bg-sem-proximo-dot', label: 'Amarillo' },
  NARANJA: { cls: 'bg-sem-critico-dot', label: 'Naranja' },
  ROJO: { cls: 'bg-sem-vencido-dot', label: 'Rojo' },
  GRIS: { cls: 'bg-sem-sinfecha-dot', label: 'Gris' },
};

type SortKey = 'default' | 'deadline' | 'score' | 'code';

export function Dashboard({ board }: { board: Board }) {
  const [source, setSource] = useState('');
  const [semaphore, setSemaphore] = useState<Semaphore | ''>('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showMissing, setShowMissing] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = board.indicators.filter((i) => {
      if (!showMissing && i.missing) return false;
      if (source && i.sourceId !== source) return false;
      if (semaphore && i.semaphore !== semaphore) return false;
      if (q && !`${i.code} ${i.name} ${i.section ?? ''} ${i.responsible} ${i.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === 'deadline') list.sort((a, b) => (a.daysRemaining ?? 1e9) - (b.daysRemaining ?? 1e9));
    if (sort === 'score') list.sort((a, b) => (a.score ?? -1) - (b.score ?? -1));
    if (sort === 'code') list.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
    return list;
  }, [board.indicators, source, semaphore, query, sort, showMissing]);

  const grouped = sort === 'default';
  const last = board.lastRefresh;
  const lastOk = board.sources.map((s) => s.lastRefreshAt).filter(Boolean).sort().pop() ?? null;
  const failedSources = board.sources.filter((s) => s.lastStatus && s.lastStatus !== 'OK');
  const missingCount = board.indicators.filter((i) => i.missing).length;
  const hasData = board.indicators.length > 0;

  return (
    <>
      <header className="bg-surface border-b border-line">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3">
          <Image src="/inapa-logo.png" alt="INAPA – Instituto Nacional de Aguas Potables y Alcantarillados" width={500} height={110} priority className="h-11 w-auto" />
          <div className="hidden h-8 w-px bg-line sm:block" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-[1.0667rem] leading-tight font-semibold">Seguimiento SISMAP</h1>
            <p className="text-xs text-ink-2">Indicadores del Ministerio de Administración Pública</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="/api/export" className="btn btn-secondary" download>
              <IconDownload size={16} />
              Exportar a Excel
            </a>
            <RefreshButton initiallyRunning={last?.status === 'RUNNING'} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          <span className={`inline-block h-2 w-2 rounded-full ${failedSources.length ? 'bg-sem-atencion-dot' : lastOk ? 'bg-sem-normal-dot' : 'bg-sem-sinfecha-dot'}`} aria-hidden />
          {lastOk ? (
            <>
              Última actualización correcta <strong className="text-ink">{fmtDateTime(lastOk)}</strong>
            </>
          ) : (
            'Sin datos todavía'
          )}
          {hasData && (
            <>
              <span aria-hidden>·</span>
              <span>
                {board.totals.total} indicadores en {board.sources.length} fuentes
              </span>
            </>
          )}
          {last && last.status !== 'RUNNING' && last.status !== 'OK' && (
            <>
              <span aria-hidden>·</span>
              <span className="text-sem-vencido-ink">
                Último intento {fmtDateTime(last.startedAt)}: {last.status === 'PARTIAL' ? 'parcial' : 'falló'}
              </span>
            </>
          )}
        </p>

        {failedSources.length > 0 && (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-sem-atencion-dot/50 bg-sem-atencion-bg p-3 text-sm text-sem-atencion-ink">
            <IconAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{failedSources.length === 1 ? 'Una fuente no se pudo actualizar' : `${failedSources.length} fuentes no se pudieron actualizar`}; se muestran sus últimos datos válidos.</p>
              <ul className="mt-1 space-y-0.5">
                {failedSources.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.name}</span>
                    {s.lastRefreshAt ? ` (${fmtDateTime(s.lastRefreshAt)})` : ''}: {s.lastError}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {hasData && (
          <section aria-label="Resumen por fuente" className="mt-5 grid grid-cols-2 divide-x divide-line rounded-lg bg-surface shadow-panel lg:grid-cols-4">
            {board.sources.map((s) => (
              <SourceSummary key={s.id} source={s} indicators={board.indicators.filter((i) => i.sourceId === s.id && !i.missing)} active={source === s.id} onSelect={() => setSource(source === s.id ? '' : s.id)} />
            ))}
          </section>
        )}

        {hasData && (
          <section aria-label="Semáforo de vencimientos" className="mt-5 flex flex-wrap items-center gap-2">
            {SEMAPHORE_ORDER.map((k) => (
              <button key={k} type="button" aria-pressed={semaphore === k} onClick={() => setSemaphore(semaphore === k ? '' : k)} className={`chip ${SEM_CLASS[k].chip}`}>
                <span className={`dot ${SEM_CLASS[k].dot}`} aria-hidden />
                {SEMAPHORE_LABEL[k]}
                <span className="tnum font-semibold">{board.totals[k]}</span>
              </button>
            ))}
            <span className="ml-1 text-xs text-ink-2">Según el próximo vencimiento de evidencias</span>
          </section>
        )}

        {hasData && (
          <section aria-label="Filtros" className="mt-4 flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Buscar</span>
              <IconSearch size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, indicador, sección, responsable…" className="field w-80 pl-8" />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              Fuente
              <select value={source} onChange={(e) => setSource(e.target.value)} className="field pr-7">
                <option value="">Todas</option>
                {board.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              Orden
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="field pr-7">
                <option value="default">Por fuente y sección</option>
                <option value="deadline">Próximo vencimiento</option>
                <option value="score">Puntuación, menor primero</option>
                <option value="code">Código</option>
              </select>
            </label>
            {missingCount > 0 && (
              <label className="flex items-center gap-1.5 text-sm text-ink-2">
                <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} className="accent-brand" />
                Mostrar {missingCount} que ya no aparecen en SISMAP
              </label>
            )}
            {(source || semaphore || query || sort !== 'default') && (
              <button
                type="button"
                onClick={() => {
                  setSource('');
                  setSemaphore('');
                  setQuery('');
                  setSort('default');
                }}
                className="text-sm text-brand underline-offset-2 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
            <span className="tnum ml-auto text-sm text-ink-2" aria-live="polite">
              {rows.length === board.totals.total ? `${rows.length} indicadores` : `${rows.length} de ${board.totals.total} indicadores`}
            </span>
          </section>
        )}

        <div className="table-wrap mt-3 rounded-lg bg-surface shadow-panel">
          {!hasData ? (
            <EmptyState />
          ) : (
            <table className="board w-full">
              <colgroup>
                {[34, 78, null, 86, 64, 86, 50, 122, 56, 106, 92, 164, 230].map((w, idx) => (
                  <col key={idx} style={w ? { width: w } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Evidencias</span>
                  </th>
                  <th>Código</th>
                  <th>Indicador</th>
                  <th className="num">Puntuación</th>
                  <th className="num">Peso</th>
                  <th className="num">Resultado</th>
                  <th>Color</th>
                  <th>Próx. vencimiento</th>
                  <th className="num">Días</th>
                  <th>Semáforo</th>
                  <th className="num">Evidencias</th>
                  <th>Responsable</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-ink-2">
                      Ningún indicador coincide con los filtros.
                    </td>
                  </tr>
                )}
                {rows.map((i, idx) => {
                  const prev = rows[idx - 1];
                  const groupKey = `${i.sourceName}${i.section ? ` › ${i.section}` : ''}`;
                  const prevKey = prev ? `${prev.sourceName}${prev.section ? ` › ${prev.section}` : ''}` : null;
                  return (
                    <Fragment key={i.id}>
                      {grouped && groupKey !== prevKey && (
                        <tr className="group">
                          <td colSpan={13}>{groupKey}</td>
                        </tr>
                      )}
                      <IndicatorRow i={i} open={!!open[i.id]} onToggle={() => setOpen((o) => ({ ...o, [i.id]: !o[i.id] }))} showSource={!grouped} />
                      {open[i.id] && <EvidenceRows i={i} />}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
          <span>Datos de SISMAP, Ministerio de Administración Pública. Responsable y notas son información interna de INAPA y se conservan en cada actualización.</span>
          <span>Semáforo: vencido · crítico 0-3 días · atención 4-7 · próximo 8-15 · normal más de 15</span>
        </footer>
      </main>
    </>
  );
}

function SourceSummary({ source: s, indicators, active, onSelect }: { source: BoardSource; indicators: BoardIndicator[]; active: boolean; onSelect: () => void }) {
  const failed = !!s.lastStatus && s.lastStatus !== 'OK';
  const headline = s.kind === 'RANKING' ? indicators.find((i) => i.code === 'IndicedeCumplimiento')?.score ?? null : s.lastOverallScore;
  const headlineLabel = s.kind === 'RANKING' ? 'Índice de cumplimiento' : 'Promedio general';
  const overdue = indicators.filter((i) => i.semaphore === 'VENCIDO').length;
  const soon = indicators.filter((i) => i.semaphore === 'CRITICO' || i.semaphore === 'ATENCION' || i.semaphore === 'PROXIMO').length;
  return (
    <button type="button" onClick={onSelect} aria-pressed={active} className={`group/src p-4 text-left transition-colors first:rounded-l-lg last:rounded-r-lg hover:bg-brand-tint/50 ${active ? 'bg-brand-tint/70' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium" title={s.name}>
          {s.name}
        </span>
        {failed && <span className="shrink-0 rounded bg-sem-vencido-bg px-1.5 py-0.5 text-[0.7rem] font-semibold text-sem-vencido-ink">{s.lastStatus === 'ANOMALY' ? 'Anómalo' : 'Falló'}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tnum text-2xl font-semibold tracking-tight">{headline !== null ? `${fmtNumber(headline, 1)} %` : '—'}</span>
        <span className="text-xs text-ink-2">{headlineLabel}</span>
      </div>
      <div className="progress mt-2" aria-hidden>
        <span style={{ width: `${Math.max(0, Math.min(100, headline ?? 0))}%` }} />
      </div>
      <p className="tnum mt-2 text-xs text-ink-2">
        {indicators.length} {s.kind === 'RANKING' ? 'índices' : 'indicadores'}
        {overdue ? <span className="text-sem-vencido-ink"> · {overdue} vencido{overdue > 1 ? 's' : ''}</span> : null}
        {soon ? ` · ${soon} por vencer` : ''}
        {s.lastRefreshAt ? ` · ${fmtDateTime(s.lastRefreshAt)}` : ''}
      </p>
    </button>
  );
}

function IndicatorRow({ i, open, onToggle, showSource }: { i: BoardIndicator; open: boolean; onToggle: () => void; showSource: boolean }) {
  const hasEvidence = i.evidencesTotal > 0;
  const color = i.color ? COLOR_META[i.color] : null;
  return (
    <tr data-row data-open={open} className={i.missing ? 'opacity-55' : ''}>
      <td className="pr-0">
        {hasEvidence && (
          <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Ocultar' : 'Ver'} evidencias de ${i.code} ${i.name}`} className="-m-1 rounded p-1 text-ink-2 hover:text-ink">
            <IconChevron size={16} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
          </button>
        )}
      </td>
      <td className="tnum font-medium whitespace-nowrap">{i.code}</td>
      <td>
        <div className="font-medium">{i.name}</div>
        {(showSource || i.status) && (
          <div className="mt-0.5 text-xs text-ink-2">
            {showSource ? i.sourceName : ''}
            {showSource && i.section ? ` › ${i.section}` : ''}
            {i.status ? `${showSource ? ' · ' : ''}${i.status === 'INACTIVO_TEMPORAL' ? 'Inactivo temporal en SISMAP' : i.status === 'SIN_DATO' ? 'Sin dato en SISMAP' : i.status}` : ''}
          </div>
        )}
      </td>
      <td className="num font-semibold">{fmtNumber(i.score)}</td>
      <td className="num text-ink-2">{fmtNumber(i.weight)}</td>
      <td className="num text-ink-2">{fmtNumber(i.weightedResult)}</td>
      <td>
        {color && (
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${color.cls}`} aria-hidden />
            <span className="sr-only">{color.label}</span>
          </span>
        )}
      </td>
      <td className="tnum whitespace-nowrap">{fmtDate(i.deadline)}</td>
      <td className={`num ${i.daysRemaining !== null && i.daysRemaining < 0 ? 'font-semibold text-sem-vencido-ink' : ''}`}>{i.daysRemaining ?? ''}</td>
      <td>
        <span className={`chip h-6 px-2 text-xs ${SEM_CLASS[i.semaphore].chip}`}>
          <span className={`dot ${SEM_CLASS[i.semaphore].dot}`} aria-hidden />
          {SEMAPHORE_LABEL[i.semaphore]}
        </span>
      </td>
      <td className="num">
        {hasEvidence ? (
          <span>
            <span className={i.evidencesOverdue ? 'font-semibold text-sem-vencido-ink' : ''}>{i.evidencesOverdue}</span>
            <span className="text-ink-3"> / </span>
            {i.evidencesTotal}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </td>
      <td className="py-1.5">
        <EditableCell indicatorId={i.id} field="responsible" value={i.responsible} label={`Responsable de ${i.code} ${i.name}`} />
      </td>
      <td className="py-1.5">
        <EditableCell indicatorId={i.id} field="notes" value={i.notes} label={`Notas de ${i.code} ${i.name}`} multiline />
      </td>
    </tr>
  );
}

function EvidenceRows({ i }: { i: BoardIndicator }) {
  return (
    <tr className="detail">
      <td />
      <td colSpan={12}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-2">
              <th className="py-1.5 pr-3 text-left font-medium">Evidencia</th>
              <th className="w-36 py-1.5 pr-3 text-left font-medium">Vencimiento</th>
              <th className="w-56 py-1.5 pr-3 text-left font-medium">Verificado por (MAP)</th>
              <th className="w-20 py-1.5 pr-3 text-right font-medium">Valor</th>
              <th className="w-44 py-1.5 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {i.evidences.map((e) => (
              <tr key={e.id} className={`border-t border-line/70 ${e.missing ? 'opacity-55' : ''}`}>
                <td className="py-1.5 pr-3">
                  <span className="tnum mr-2 text-ink-2">{e.code}</span>
                  {e.name}
                </td>
                <td className={`tnum py-1.5 pr-3 whitespace-nowrap ${e.overdue ? 'font-semibold text-sem-vencido-ink' : ''}`}>{fmtDate(e.dueDate) || <span className="text-ink-3">—</span>}</td>
                <td className="py-1.5 pr-3">{e.verifiedBy ?? <span className="text-ink-3">—</span>}</td>
                <td className="tnum py-1.5 pr-3 text-right">{fmtNumber(e.value)}</td>
                <td className="py-1.5">
                  {e.status ?? (e.overdue ? 'Vencido' : <span className="text-ink-3">—</span>)}
                  {e.missing ? <span className="text-ink-2"> · ya no aparece en SISMAP</span> : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Image src="/favicon-192.png" alt="" width={56} height={56} className="opacity-90" />
      <h2 className="mt-4 text-lg font-semibold">Todavía no hay datos de SISMAP</h2>
      <p className="mt-2 max-w-md text-sm text-ink-2">
        Pulse <strong className="text-ink">Actualizar datos</strong> arriba a la derecha. La aplicación iniciará sesión en SISMAP con la cuenta institucional, leerá las cuatro fuentes y mostrará aquí los indicadores con sus evidencias y vencimientos. Suele tardar menos de un minuto.
      </p>
    </div>
  );
}
