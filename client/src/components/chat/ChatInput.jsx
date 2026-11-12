import { useLayoutEffect, useRef, useState } from 'react';

export const MESSAGE_MAX_LENGTH = 4000;
const COUNTER_THRESHOLD = 3500;
const MAX_HEIGHT_PX = 200;

export default function ChatInput({ onSend, sending = false, disabled = false }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const trimmed = value.trim();
  const tooLong = trimmed.length > MESSAGE_MAX_LENGTH;
  const canSend = Boolean(trimmed) && !tooLong && !sending && !disabled;

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your issue… (Enter to send, Shift+Enter for a new line)"
          className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M3.1 2.3a.75.75 0 0 0-.9 1l2.3 6.2H11a.75.75 0 0 1 0 1.5H4.5l-2.3 6.2a.75.75 0 0 0 .9 1l15-7.2a.75.75 0 0 0 0-1.4z" />
          </svg>
        </button>
      </div>
      <div className="mt-1 flex justify-between px-1 text-xs text-slate-400">
        <span>Ava can make mistakes. Verify important information with a human agent.</span>
        {trimmed.length > COUNTER_THRESHOLD && (
          <span className={tooLong ? 'font-medium text-red-600' : ''}>
            {trimmed.length}/{MESSAGE_MAX_LENGTH}
          </span>
        )}
      </div>
    </form>
  );
}
