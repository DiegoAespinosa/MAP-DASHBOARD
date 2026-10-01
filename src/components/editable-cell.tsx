'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconPencil, IconSpinner } from '@/components/icons';

interface Props {
  indicatorId: string;
  field: 'responsible' | 'notes';
  value: string;
  label: string;
  multiline?: boolean;
}

/** Celda editable en línea: guarda al salir del campo. La actualización desde SISMAP nunca toca estos datos. */
export function EditableCell({ indicatorId, field, value, label, multiline }: Props) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(value);
    setSaved(value);
  }, [value]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function save() {
    if (text === saved) return;
    setState('saving');
    try {
      const res = await fetch(`/api/indicators/${indicatorId}/internal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved(text);
      setState('saved');
      timer.current = setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
    }
  }

  const shared = {
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value),
    onBlur: save,
    placeholder: 'Añadir…',
    'aria-label': label,
    'aria-invalid': state === 'error' ? true : undefined,
    className: 'editable',
  };

  return (
    <div className="editable-wrap relative">
      {multiline ? (
        <textarea {...shared} rows={Math.min(4, Math.max(1, Math.ceil(text.length / 38)))} className="editable resize-none" />
      ) : (
        <input
          {...shared}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setText(saved);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      )}
      <span className="pointer-events-none absolute top-1.5 right-1.5 text-ink-3" aria-live="polite">
        {state === 'saving' && <IconSpinner size={14} />}
        {state === 'saved' && (
          <span className="text-ok fade-in">
            <IconCheck size={14} />
            <span className="sr-only">Guardado</span>
          </span>
        )}
        {state === 'idle' && <IconPencil size={13} className="opacity-0 transition-opacity [.editable-wrap:hover_&]:opacity-100" />}
      </span>
      {state === 'error' && (
        <p role="alert" className="mt-1 text-xs text-danger">
          No se pudo guardar.{' '}
          <button type="button" onClick={save} className="underline">
            Reintentar
          </button>
        </p>
      )}
    </div>
  );
}
