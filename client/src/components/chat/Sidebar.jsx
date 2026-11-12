import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat.js';
import { useAuth } from '../../hooks/useAuth.js';
import ConversationItem from './ConversationItem.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import ErrorBanner from '../common/ErrorBanner.jsx';
import { Spinner } from '../common/Spinner.jsx';
import { BrandMark } from '../auth/AuthLayout.jsx';
import { getErrorMessage } from '../../utils/errors.js';

function HistorySkeleton() {
  return (
    <ul className="space-y-2 px-3" aria-hidden="true" data-testid="history-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </ul>
  );
}

export default function Sidebar({ open, onClose }) {
  const chat = useChat();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const select = (id) => {
    navigate(`/chat/${id}`);
    onClose();
  };

  const startNew = () => {
    chat.startNewConversation();
    onClose();
  };

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
    setDeleteError('');
  }, []);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await chat.deleteConversation(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete the conversation.'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
    } catch (err) {
      setLogoutError(getErrorMessage(err, 'Could not log out. Please try again.'));
      setLoggingOut(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        aria-label="Conversations"
        data-open={open}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <BrandMark className="h-8 w-8" />
            <span className="text-sm font-semibold text-slate-900">Ava Support</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversations"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            ×
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={startNew}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <span aria-hidden="true">＋</span> New chat
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pb-3" aria-label="Previous conversations">
          <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">History</h2>
          {chat.historyStatus === 'loading' && <HistorySkeleton />}
          {chat.historyStatus === 'error' && (
            <div className="px-3">
              <ErrorBanner message={chat.historyError} onRetry={chat.loadHistory} />
            </div>
          )}
          {chat.historyStatus === 'ready' && chat.conversations.length === 0 && (
            <p className="px-4 text-sm text-slate-500">No conversations yet. Start one to see it here.</p>
          )}
          {chat.historyStatus === 'ready' && chat.conversations.length > 0 && (
            <ul className="space-y-1 px-2">
              {chat.conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === chat.activeConversationId}
                  onSelect={select}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>
          )}
          {chat.historyStatus === 'ready' && chat.historyMeta?.hasMore && (
            <div className="px-3 pt-2">
              <button
                type="button"
                onClick={chat.loadMoreHistory}
                disabled={chat.loadingMoreHistory}
                className="w-full rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                {chat.loadingMoreHistory ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </nav>

        {logoutError && (
          <div className="shrink-0 px-3 pb-2">
            <ErrorBanner message={logoutError} onDismiss={() => setLogoutError('')} />
          </div>
        )}
        <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 p-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
          >
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            {loggingOut ? <Spinner className="h-4 w-4" label="Logging out…" /> : 'Log out'}
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete conversation?"
        description={`"${pendingDelete?.title ?? ''}" and all of its messages will be permanently deleted.`}
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
}
