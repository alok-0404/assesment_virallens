import { useEffect, useRef } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useAuth } from '../../hooks/useAuth.js';
import MessageBubble from './MessageBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import SuggestedPrompts from './SuggestedPrompts.jsx';
import ErrorBanner from '../common/ErrorBanner.jsx';
import { Spinner } from '../common/Spinner.jsx';
import { BrandMark } from '../auth/AuthLayout.jsx';

function WelcomeState({ onSelect, disabled }) {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <BrandMark className="h-12 w-12" />
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Hi{firstName ? ` ${firstName}` : ''}, how can we help today?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ask Ava about orders, returns, billing or your account. Pick a suggestion or type below.
        </p>
      </div>
      <SuggestedPrompts onSelect={onSelect} disabled={disabled} />
    </div>
  );
}

export default function MessageList() {
  const chat = useChat();
  const containerRef = useRef(null);
  const lastMessageId = chat.messages.at(-1)?.id;

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastMessageId, chat.isTyping, chat.messagesStatus]);

  if (chat.messagesStatus === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <Spinner className="h-5 w-5 text-brand-600" label="Loading conversation…" />
      </div>
    );
  }

  if (chat.messagesStatus === 'not_found') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Conversation not found</h2>
        <p className="text-sm text-slate-600">It may have been deleted or it belongs to another account.</p>
        <button
          type="button"
          onClick={chat.startNewConversation}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Start a new chat
        </button>
      </div>
    );
  }

  if (chat.messagesStatus === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <ErrorBanner message={chat.messagesError} onRetry={chat.reloadMessages} className="max-w-md" />
      </div>
    );
  }

  const isEmpty = chat.messages.length === 0;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto" aria-live="off">
      {isEmpty && !chat.activeConversationId ? (
        <WelcomeState onSelect={chat.sendMessage} disabled={chat.isSending} />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {chat.hasMore && (
            <button
              type="button"
              onClick={chat.loadOlderMessages}
              disabled={chat.loadingOlder}
              className="self-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {chat.loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          )}
          {chat.messagesError && <ErrorBanner message={chat.messagesError} />}
          {chat.messages.map((message) => (
            <MessageBubble key={message.id} message={message} onRetry={chat.retryMessage} />
          ))}
          {chat.isTyping && <TypingIndicator />}
        </div>
      )}
    </div>
  );
}
