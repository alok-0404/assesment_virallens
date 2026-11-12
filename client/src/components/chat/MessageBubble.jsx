import MarkdownContent from './MarkdownContent.jsx';
import CopyButton from './CopyButton.jsx';
import { formatTime } from '../../utils/format.js';

export function AssistantAvatar() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
    >
      A
    </span>
  );
}

export default function MessageBubble({ message, onRetry }) {
  if (message.role === 'assistant') {
    return (
      <div className="flex gap-3" data-testid="message" data-role="assistant">
        <AssistantAvatar />
        <div className="min-w-0 max-w-[85%] sm:max-w-[75%]">
          <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            <MarkdownContent content={message.content} />
          </div>
          <div className="mt-1 flex items-center gap-2 pl-1 text-xs text-slate-400">
            <CopyButton text={message.content} label="Copy response" />
            {message.createdAt && <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>}
          </div>
        </div>
      </div>
    );
  }

  const failed = message.status === 'failed';
  const sending = message.status === 'sending';

  return (
    <div className="flex justify-end" data-testid="message" data-role="user">
      <div className="flex max-w-[85%] flex-col items-end sm:max-w-[75%]">
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-2.5 text-sm ${
            failed ? 'border border-red-200 bg-red-50 text-red-900' : 'bg-brand-600 text-white'
          } ${sending ? 'opacity-70' : ''}`}
        >
          {message.content}
        </div>
        {failed ? (
          <div role="alert" className="mt-1 flex items-center gap-2 text-xs text-red-600">
            <span>{message.error || 'Message failed to send.'}</span>
            <button
              type="button"
              onClick={() => onRetry?.(message.id)}
              className="font-semibold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <span className="mt-1 pr-1 text-xs text-slate-400">
            {sending ? 'Sending…' : message.createdAt && formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
