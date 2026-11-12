import { useEffect, useRef, useState } from 'react';

const LABELS = { idle: null, copied: 'Copied!', error: 'Copy failed' };

export default function CopyButton({ text, label = 'Copy', className = '' }) {
  const [state, setState] = useState('idle');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('error');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M7 3a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7zm4 12v1H4V8h1v5a2 2 0 0 0 2 2h4zM7 5h7v8H7V5z" />
      </svg>
      <span aria-live="polite">{LABELS[state] ?? 'Copy'}</span>
    </button>
  );
}
