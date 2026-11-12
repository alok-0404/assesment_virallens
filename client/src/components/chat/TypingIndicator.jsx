import { AssistantAvatar } from './MessageBubble.jsx';

export default function TypingIndicator() {
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <AssistantAvatar />
      <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="typing-dot h-2 w-2 rounded-full bg-slate-400"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="sr-only">Assistant is typing…</span>
      </div>
    </div>
  );
}
