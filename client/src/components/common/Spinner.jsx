export function Spinner({ className = 'h-5 w-5', label }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <svg
        className={`animate-spin text-current ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
      </svg>
      <span className={label ? 'text-sm' : 'sr-only'}>{label || 'Loading…'}</span>
    </span>
  );
}

export function FullPageSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex h-full items-center justify-center text-slate-500">
      <Spinner className="h-6 w-6 text-brand-600" label={label} />
    </div>
  );
}
