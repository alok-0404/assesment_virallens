export default function ErrorBanner({ message, onRetry, onDismiss, className = '' }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 ${className}`}
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
          clipRule="evenodd"
        />
      </svg>
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium underline hover:no-underline">
          Retry
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="font-medium">
          ×
        </button>
      )}
    </div>
  );
}
