'use client';

import { useEffect, useState } from 'react';

interface Props {
  indicatorId: string;
  field: 'responsible' | 'notes';
  value: string;
  multiline?: boolean;
}

/** Celda editable; guarda al salir del campo. La actualización desde SISMAP nunca toca estos datos. */
export function EditableCell({ indicatorId, field, value, multiline }: Props) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    setText(value);
    setSaved(value);
  }, [value]);

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
      setState('idle');
    } catch {
      setState('error');
    }
  }

  const base = 'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none';
  const status = state === 'saving' ? 'opacity-60' : state === 'error' ? 'border-red-400' : '';
  return (
    <div className="relative min-w-[10rem]">
      {multiline ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={save} rows={text.length > 60 ? 3 : 1} placeholder="—" className={`${base} ${status} resize-y`} />
      ) : (
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder="—" className={`${base} ${status}`} />
      )}
      {state === 'error' && <span className="absolute -bottom-3 left-1 text-[10px] text-red-600">No se pudo guardar</span>}
    </div>
  );
}
