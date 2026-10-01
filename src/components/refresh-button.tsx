'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface RefreshRow {
  id: string;
  status: 'RUNNING' | 'OK' | 'PARTIAL' | 'FAILED';
  progress?: { index?: number; total?: number; sourceName?: string; stage?: string } | null;
  summary?: { sources?: Array<{ sourceName: string; status: string; indicators: number; error?: string; warnings?: string[] }> } | null;
  error?: string | null;
}

export function RefreshButton({ initiallyRunning }: { initiallyRunning: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(initiallyRunning);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<RefreshRow | null>(null);
  const [error, setError] = useState<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackingId = useRef<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(trackingId.current ? `/api/refresh?id=${trackingId.current}` : '/api/refresh', { cache: 'no-store' });
      const row = (await res.json()) as RefreshRow | null;
      if (!row) return;
      if (row.status === 'RUNNING') {
        const p = row.progress ?? {};
        setProgress(p.sourceName ? `${p.index ?? ''}/${p.total ?? ''} · ${p.sourceName} · ${p.stage ?? ''}` : (p.stage ?? 'Iniciando'));
        timer.current = setTimeout(poll, 2000);
      } else {
        setRunning(false);
        setProgress('');
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
    const res = await fetch('/api/refresh', { method: 'POST' });
    if (res.status === 202 || res.status === 409) {
      const body = await res.json().catch(() => ({}));
      trackingId.current = body.id ?? null;
      setRunning(true);
      setProgress('Iniciando');
      poll();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Error ${res.status}`);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={start}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {running ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            Actualizando…
          </>
        ) : (
          'Actualizar datos'
        )}
      </button>
      {running && progress && <span className="text-xs text-slate-600">{progress}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
      {result && !running && <ResultNote row={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function ResultNote({ row, onClose }: { row: RefreshRow; onClose: () => void }) {
  const tone = row.status === 'OK' ? 'bg-green-50 text-green-800 border-green-200' : row.status === 'PARTIAL' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-red-50 text-red-800 border-red-200';
  const label = row.status === 'OK' ? 'Actualización completada' : row.status === 'PARTIAL' ? 'Actualización parcial' : 'La actualización falló';
  const sources = row.summary?.sources ?? [];
  return (
    <div className={`mt-1 max-w-md rounded-md border px-3 py-2 text-xs ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <strong>{label}</strong>
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100" aria-label="Cerrar">
          ×
        </button>
      </div>
      <ul className="mt-1 space-y-0.5">
        {sources.map((s) => (
          <li key={s.sourceName}>
            {s.sourceName}: {s.status === 'OK' ? `${s.indicators} indicadores` : s.error ?? s.status}
            {s.warnings && s.warnings.length > 0 && <span className="opacity-80"> · {s.warnings.length} aviso(s)</span>}
          </li>
        ))}
        {row.error && sources.length === 0 && <li>{row.error}</li>}
      </ul>
    </div>
  );
}
