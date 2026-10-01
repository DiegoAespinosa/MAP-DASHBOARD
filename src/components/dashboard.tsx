'use client';

import { Fragment, useMemo, useState } from 'react';
import { EditableCell } from '@/components/editable-cell';
import { RefreshButton } from '@/components/refresh-button';
import { fmtDate, fmtDateTime, fmtNumber } from '@/lib/format';
import { SEMAPHORE_LABEL, SEMAPHORE_ORDER, type Semaphore } from '@/lib/semaphore';
import type { Board, BoardIndicator } from '@/server/data';

const SEM_CLASS: Record<Semaphore, string> = {
  VENCIDO: 'bg-red-100 text-red-800 ring-red-200',
  CRITICO: 'bg-orange-100 text-orange-800 ring-orange-200',
  ATENCION: 'bg-amber-100 text-amber-800 ring-amber-200',
  PROXIMO: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  NORMAL: 'bg-green-100 text-green-800 ring-green-200',
  SIN_FECHA: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const COLOR_DOT: Record<string, string> = {
  VERDE_OSCURO: 'bg-green-700',
  VERDE: 'bg-green-500',
  AMARILLO: 'bg-yellow-400',
  NARANJA: 'bg-orange-500',
  ROJO: 'bg-red-600',
  GRIS: 'bg-slate-400',
};

export function Dashboard({ board }: { board: Board }) {
  const [source, setSource] = useState<string>('');
  const [semaphore, setSemaphore] = useState<Semaphore | ''>('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showMissing, setShowMissing] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.indicators.filter((i) => {
      if (!showMissing && i.missing) return false;
      if (source && i.sourceId !== source) return false;
      if (semaphore && i.semaphore !== semaphore) return false;
      if (q && !`${i.code} ${i.name} ${i.section ?? ''} ${i.responsible} ${i.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [board.indicators, source, semaphore, query, showMissing]);

  const last = board.lastRefresh;
  const lastOk = board.sources.map((s) => s.lastRefreshAt).filter(Boolean).sort().pop() ?? null;
  const missingCount = board.indicators.filter((i) => i.missing).length;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Indicadores SISMAP · INAPA</h1>
          <p className="mt-1 text-sm text-slate-600">
            Última actualización correcta: <strong>{lastOk ? fmtDateTime(lastOk) : 'nunca'}</strong>
            {last && last.status !== 'RUNNING' && last.status !== 'OK' && (
              <span className="ml-2 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                Último intento {fmtDateTime(last.startedAt)}: {last.status === 'PARTIAL' ? 'parcial' : 'falló'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <a href="/api/export" className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100">
            Exportar a Excel
          </a>
          <RefreshButton initiallyRunning={last?.status === 'RUNNING'} />
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {board.sources.map((s) => (
          <div key={s.id} className={`rounded-lg border bg-white p-3 shadow-sm ${s.lastStatus && s.lastStatus !== 'OK' ? 'border-red-300' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-sm font-medium text-slate-700" title={s.name}>
                {s.name}
              </h2>
              {s.lastStatus && s.lastStatus !== 'OK' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{s.lastStatus}</span>}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{s.lastOverallScore !== null ? `${fmtNumber(s.lastOverallScore)} %` : s.kind === 'RANKING' ? 'Índices' : '—'}</span>
              <span className="text-xs text-slate-500">{s.indicatorCount} indicadores</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-500" title={s.lastError ?? ''}>
              {s.lastRefreshAt ? fmtDateTime(s.lastRefreshAt) : 'sin datos'}
              {s.lastError ? ` · ${s.lastError}` : ''}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        {SEMAPHORE_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSemaphore(semaphore === k ? '' : k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${SEM_CLASS[k]} ${semaphore === k ? 'ring-2 ring-offset-1' : ''}`}
          >
            {SEMAPHORE_LABEL[k]}: {board.totals[k]}
          </button>
        ))}
        <span className="self-center text-xs text-slate-500">Total: {board.totals.total}</span>
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
          <option value="">Todas las fuentes</option>
          {board.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, indicador, responsable…" className="w-72 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
        {missingCount > 0 && (
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} /> Mostrar {missingCount} que ya no aparecen en SISMAP
          </label>
        )}
        <span className="ml-auto text-xs text-slate-500">{rows.length} filas</span>
      </section>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="board w-full border-collapse">
          <thead>
            <tr>
              <th />
              <th>Fuente</th>
              <th>Código</th>
              <th>Indicador</th>
              <th className="text-right">Puntuación</th>
              <th className="text-right">Peso</th>
              <th className="text-right">Resultado</th>
              <th>Color</th>
              <th>Próximo vencimiento</th>
              <th className="text-right">Días</th>
              <th>Semáforo</th>
              <th className="text-right">Evidencias</th>
              <th>Responsable</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="py-10 text-center text-slate-500">
                  {board.indicators.length === 0 ? 'Todavía no hay datos. Pulse "Actualizar datos".' : 'Ningún indicador coincide con el filtro.'}
                </td>
              </tr>
            )}
            {rows.map((i) => (
              <Fragment key={i.id}>
                <IndicatorRow i={i} open={!!open[i.id]} onToggle={() => setOpen((o) => ({ ...o, [i.id]: !o[i.id] }))} />
                {open[i.id] && <EvidenceRows i={i} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Datos de SISMAP (Ministerio de Administración Pública). Responsable y notas son información interna de INAPA y se conservan al actualizar.</p>
    </main>
  );
}

function IndicatorRow({ i, open, onToggle }: { i: BoardIndicator; open: boolean; onToggle: () => void }) {
  const hasEvidence = i.evidencesTotal > 0;
  return (
    <tr className={`${i.missing ? 'opacity-50' : ''} hover:bg-slate-50`}>
      <td className="w-6">
        {hasEvidence && (
          <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? 'Ocultar evidencias' : 'Ver evidencias'} className="text-slate-500 hover:text-slate-900">
            {open ? '▾' : '▸'}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap text-slate-600">{i.sourceName}</td>
      <td className="whitespace-nowrap font-mono text-xs">{i.code}</td>
      <td>
        <div className="font-medium">{i.name}</div>
        {i.section && <div className="text-[11px] text-slate-500">{i.section}</div>}
        {i.status && <div className="text-[11px] text-slate-500">{i.status === 'INACTIVO_TEMPORAL' ? 'Inactivo temporal' : i.status === 'SIN_DATO' ? 'Sin dato' : i.status}</div>}
      </td>
      <td className="text-right font-semibold">{fmtNumber(i.score)}</td>
      <td className="text-right text-slate-600">{fmtNumber(i.weight)}</td>
      <td className="text-right text-slate-600">{fmtNumber(i.weightedResult)}</td>
      <td>{i.color && <span title={i.color} className={`inline-block h-3 w-3 rounded-full ${COLOR_DOT[i.color] ?? 'bg-slate-300'}`} />}</td>
      <td className="whitespace-nowrap">{fmtDate(i.deadline)}</td>
      <td className={`text-right ${i.daysRemaining !== null && i.daysRemaining < 0 ? 'text-red-700' : ''}`}>{i.daysRemaining ?? ''}</td>
      <td>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${SEM_CLASS[i.semaphore]}`}>{SEMAPHORE_LABEL[i.semaphore]}</span>
      </td>
      <td className="text-right">
        {hasEvidence ? (
          <span className={i.evidencesOverdue ? 'text-red-700' : ''}>
            {i.evidencesOverdue} / {i.evidencesTotal}
          </span>
        ) : (
          ''
        )}
      </td>
      <td>
        <EditableCell indicatorId={i.id} field="responsible" value={i.responsible} />
      </td>
      <td>
        <EditableCell indicatorId={i.id} field="notes" value={i.notes} multiline />
      </td>
    </tr>
  );
}

function EvidenceRows({ i }: { i: BoardIndicator }) {
  return (
    <tr className="bg-slate-50/70">
      <td />
      <td colSpan={13} className="py-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="px-2 py-1 text-left font-medium">Evidencia</th>
              <th className="px-2 py-1 text-left font-medium">Vencimiento</th>
              <th className="px-2 py-1 text-left font-medium">Verificado por</th>
              <th className="px-2 py-1 text-right font-medium">Valor</th>
              <th className="px-2 py-1 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {i.evidences.map((e) => (
              <tr key={e.id} className={e.missing ? 'opacity-50' : ''}>
                <td className="px-2 py-1">
                  <span className="font-mono">{e.code}</span> {e.name}
                </td>
                <td className={`px-2 py-1 whitespace-nowrap ${e.overdue ? 'text-red-700' : ''}`}>{fmtDate(e.dueDate)}</td>
                <td className="px-2 py-1">{e.verifiedBy ?? ''}</td>
                <td className="px-2 py-1 text-right">{fmtNumber(e.value)}</td>
                <td className="px-2 py-1">{e.status ?? (e.overdue ? 'Vencido' : '')}{e.missing ? ' · ya no aparece' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}
