'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlert, IconCheck, IconClose, IconRefresh, IconSpinner } from '@/components/icons';
import { withBasePath } from '@/lib/base-path';

interface RefreshRow {
  id: string;
  status: 'RUNNING' | 'OK' | 'PARTIAL' | 'FAILED';
  progress?: { index?: number; total?: number; sourceName?: string; stage?: string } | null;
  summary?: { sources?: Array<{ sourceName: string; status: string; indicators: number; evidences: number; error?: string; warnings?: string[] }> } | null;
  error?: string | null;
}

const STAGE_LABEL: Record<string, string> = {
  INICIANDO: 'Iniciando',
  CONECTANDO: 'Conectando',
  AUTENTICANDO: 'Iniciando sesión en SISMAP',
  DESCARGANDO: 'Descargando',
  VALIDANDO: 'Validando',
  GUARDANDO: 'Guardando',
  FINALIZADO: 'Finalizado',
};

export function RefreshButton({ initiallyRunning }: { initiallyRunning: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(initiallyRunning);
  const [progress, setProgress] = useState<RefreshRow['progress']>(null);
  const [result, setResult] = useState<RefreshRow | null>(null);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackingId = useRef<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(withBasePath(trackingId.current ? `/api/refresh?id=${trackingId.current}` : '/api/refresh'), { cache: 'no-store' });
      const row = (await res.json()) as RefreshRow | null;
      if (!row) return;
      if (row.status === 'RUNNING') {
        setProgress(row.progress ?? null);
        timer.current = setTimeout(poll, 2000);
      } else {
        setRunning(false);
        setProgress(null);
        setResult(row);
        router.refresh();
      }
    } catch {
      timer.current = setTimeout(poll, 3000);
    }
  }, [router]);

  useEffect(() => {
    if (running) poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError('');
    setResult(null);
    setRunning(true);
    setProgress({ stage: 'INICIANDO' });
    const res = await fetch(withBasePath('/api/refresh'), { method: 'POST' });
    if (res.status === 202 || res.status === 409) {
      const body = await res.json().catch(() => ({}));
      trackingId.current = body.id ?? null;
      poll();
    } else {
      const body = await res.json().catch(() => ({}));
      setRunning(false);
      setProgress(null);
      setError(body.error ?? `Error ${res.status}`);
    }
  }

  const total = progress?.total ?? 0;
  const index = progress?.index ?? 0;
  const percent = total ? Math.min(100, Math.round(((index - 1 + (progress?.stage === 'GUARDANDO' ? 0.8 : progress?.stage === 'VALIDANDO' ? 0.6 : 0.3)) / total) * 100)) : 5;

  return (
    <div className="relative">
      <button type="button" onClick={start} disabled={running} className="btn btn-primary" aria-busy={running}>
        {running ? <IconSpinner size={16} /> : <IconRefresh size={16} />}
        {running ? 'Actualizando…' : 'Actualizar datos'}
      </button>

      {running && (
        <div role="status" className="fade-in absolute right-0 z-20 mt-2 w-80 rounded-lg bg-surface p-3 text-sm shadow-panel">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{total ? `Fuente ${index} de ${total}` : 'Preparando'}</span>
            <span className="tnum text-xs text-ink-2">{percent} %</span>
          </div>
          <div className="progress mt-2">
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 truncate text-ink-2">
            {progress?.sourceName ? `${progress.sourceName} · ` : ''}
            {STAGE_LABEL[progress?.stage ?? ''] ?? progress?.stage ?? ''}
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="fade-in absolute right-0 z-20 mt-2 w-80 rounded-lg border border-danger/30 bg-sem-vencido-bg p-3 text-sm text-sem-vencido-ink">
          {error}
        </div>
      )}

      {result && !running && <ResultNote row={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function ResultNote({ row, onClose }: { row: RefreshRow; onClose: () => void }) {
  const ok = row.status === 'OK';
  const partial = row.status === 'PARTIAL';
  const tone = ok ? 'bg-sem-normal-bg text-sem-normal-ink border-sem-normal-dot/40' : partial ? 'bg-sem-atencion-bg text-sem-atencion-ink border-sem-atencion-dot/50' : 'bg-sem-vencido-bg text-sem-vencido-ink border-sem-vencido-dot/40';
  const title = ok ? 'Datos actualizados' : partial ? 'Actualización parcial' : 'No se pudo actualizar';
  const sources = row.summary?.sources ?? [];
  return (
    <div role="status" className={`fade-in absolute right-0 z-20 mt-2 w-96 rounded-lg border p-3 text-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold">
          {ok ? <IconCheck size={16} /> : <IconAlert size={16} />}
          {title}
        </span>
        <button type="button" onClick={onClose} className="-m-1 rounded p-1 opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
          <IconClose size={14} />
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {sources.map((s) => (
          <li key={s.sourceName} className="flex gap-2">
            <span className="w-40 shrink-0 truncate" title={s.sourceName}>
              {s.sourceName}
            </span>
            <span className="min-w-0 flex-1">
              {s.status === 'OK' ? (
                <>
                  {s.indicators} indicadores
                  {s.evidences ? `, ${s.evidences} evidencias` : ''}
                  {s.warnings?.length ? <span className="opacity-80"> · {s.warnings.length} aviso{s.warnings.length > 1 ? 's' : ''}</span> : null}
                </>
              ) : (
                <span title={s.error}>{s.status === 'ANOMALY' ? 'Resultado anómalo; datos anteriores conservados' : 'Falló; datos anteriores conservados'}</span>
              )}
            </span>
          </li>
        ))}
        {row.error && sources.length === 0 && <li>{row.error}</li>}
      </ul>
    </div>
  );
}
