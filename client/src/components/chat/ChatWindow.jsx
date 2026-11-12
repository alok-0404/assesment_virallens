import { useChat } from '../../hooks/useChat.js';
import MessageList from './MessageList.jsx';
import ChatInput from './ChatInput.jsx';

export default function ChatWindow({ onOpenSidebar }) {
  const chat = useChat();
  const title =
    chat.activeConversation?.title ?? (chat.activeConversationId ? 'Conversation' : 'New conversation');
  const inputDisabled = chat.messagesStatus === 'loading' || chat.messagesStatus === 'not_found';

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-slate-50" aria-label="Chat">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open conversations"
          className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M3 5h14a1 1 0 1 0 0-2H3a1 1 0 0 0 0 2zm14 4H3a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2zm0 6H3a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2z" />
          </svg>
        </button>
        <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{title}</h1>
      </header>

      <MessageList />

      <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-3 pt-3 sm:px-4">
        <ChatInput onSend={chat.sendMessage} sending={chat.isSending} disabled={inputDisabled} />
      </div>
    </section>
  );
}
