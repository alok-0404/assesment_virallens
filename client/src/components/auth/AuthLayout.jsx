export function BrandMark({ className = 'h-9 w-9' }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-xl bg-brand-600 text-white ${className}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M5 8.5A3.5 3.5 0 0 1 8.5 5h7A3.5 3.5 0 0 1 19 8.5v5a3.5 3.5 0 0 1-3.5 3.5H11l-4.5 4v-4.2A3.5 3.5 0 0 1 5 13.5z" />
      </svg>
    </span>
  );
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="h-12 w-12" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </main>
  );
}
