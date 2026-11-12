import { formatRelativeTime } from '../../utils/format.js';

export default function ConversationItem({ conversation, active, onSelect, onDelete }) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-current={active ? 'page' : undefined}
        className={`w-full rounded-lg px-3 py-2 pr-10 text-left transition ${
          active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <span className="block truncate text-sm font-medium">{conversation.title}</span>
        <span className="block text-xs text-slate-500">{formatRelativeTime(conversation.lastMessageAt)}</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(conversation)}
        aria-label={`Delete conversation ${conversation.title}`}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.44c-.8.08-1.58.18-2.36.3a.75.75 0 1 0 .22 1.49l.15-.02.8 10.4A2.75 2.75 0 0 0 7.55 19h4.9a2.75 2.75 0 0 0 2.74-2.54l.8-10.4.15.02a.75.75 0 0 0 .22-1.49A41 41 0 0 0 14 4.19v-.44A2.75 2.75 0 0 0 11.25 1h-2.5zM10 4c.84 0 1.67.03 2.5.08v-.33c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.33C8.33 4.03 9.16 4 10 4zM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </li>
  );
}
