import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { chatApi } from '../api/chatApi.js';
import { getErrorMessage } from '../utils/errors.js';
import { createClientMessageId } from '../utils/ids.js';

export const ChatContext = createContext(null);

const HISTORY_PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 50;

/**
 * State for the sidebar history and the conversation selected in the URL.
 * A "view" token changes on every conversation switch so that late responses
 * (message loads, AI replies) never land in a conversation the user has left.
 */
export function ChatProvider({ conversationId, children }) {
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [historyStatus, setHistoryStatus] = useState('loading');
  const [historyError, setHistoryError] = useState('');
  const [historyMeta, setHistoryMeta] = useState(null);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);

  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesStatus, setMessagesStatus] = useState('ready');
  const [messagesError, setMessagesError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [view, setView] = useState(0);
  const [pendingView, setPendingView] = useState(null);

  const viewRef = useRef(0);
  const loadedIdRef = useRef(undefined);
  const abortRef = useRef(null);
  const sendingRef = useRef(false);
  const conversationsRef = useRef(conversations);
  const messagesRef = useRef(messages);
  conversationsRef.current = conversations;
  messagesRef.current = messages;

  const loadHistory = useCallback(async () => {
    setHistoryStatus('loading');
    setHistoryError('');
    try {
      const result = await chatApi.getHistory({ page: 1, limit: HISTORY_PAGE_SIZE });
      setConversations(result.conversations);
      setHistoryMeta(result.meta);
      setHistoryStatus('ready');
    } catch (err) {
      setHistoryStatus('error');
      setHistoryError(getErrorMessage(err, 'Could not load your conversations.'));
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadMoreHistory = useCallback(async () => {
    if (!historyMeta?.hasMore || loadingMoreHistory) return;
    setLoadingMoreHistory(true);
    try {
      const result = await chatApi.getHistory({ page: historyMeta.page + 1, limit: HISTORY_PAGE_SIZE });
      setConversations((list) => {
        const known = new Set(list.map((c) => c.id));
        return [...list, ...result.conversations.filter((c) => !known.has(c.id))];
      });
      setHistoryMeta(result.meta);
    } catch (err) {
      setHistoryError(getErrorMessage(err, 'Could not load more conversations.'));
    } finally {
      setLoadingMoreHistory(false);
    }
  }, [historyMeta, loadingMoreHistory]);

  // Load the conversation selected in the URL.
  useEffect(() => {
    const id = conversationId ?? null;
    if (loadedIdRef.current === id) return;
    loadedIdRef.current = id;

    viewRef.current += 1;
    const token = viewRef.current;
    setView(token);
    abortRef.current?.abort();
    setMessagesError('');
    setHasMore(false);
    setNextCursor(null);
    setLoadingOlder(false);

    if (!id) {
      setActiveConversation(null);
      setMessages([]);
      setMessagesStatus('ready');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setMessages([]);
    setMessagesStatus('loading');
    setActiveConversation(conversationsRef.current.find((c) => c.id === id) ?? null);

    Promise.all([
      chatApi.getConversation(id, { signal: controller.signal }),
      chatApi.getMessages(id, { limit: MESSAGES_PAGE_SIZE, signal: controller.signal }),
    ])
      .then(([conversation, page]) => {
        if (token !== viewRef.current) return;
        setActiveConversation(conversation);
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
        setMessagesStatus('ready');
      })
      .catch((err) => {
        if (token !== viewRef.current || axios.isCancel(err)) return;
        const status = err?.response?.status;
        if (status === 404 || status === 400) {
          setActiveConversation(null);
          setMessagesStatus('not_found');
        } else {
          setMessagesStatus('error');
          setMessagesError(getErrorMessage(err, 'Could not load this conversation.'));
        }
      });
  }, [conversationId, reloadKey]);

  const reloadMessages = useCallback(() => {
    loadedIdRef.current = undefined;
    setReloadKey((k) => k + 1);
  }, []);

  const loadOlderMessages = useCallback(async () => {
    const id = loadedIdRef.current;
    if (!id || !hasMore || loadingOlder) return;
    const token = viewRef.current;
    setLoadingOlder(true);
    try {
      const page = await chatApi.getMessages(id, { before: nextCursor, limit: MESSAGES_PAGE_SIZE });
      if (token !== viewRef.current) return;
      setMessages((list) => [...page.messages, ...list]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (token === viewRef.current) setMessagesError(getErrorMessage(err, 'Could not load earlier messages.'));
    } finally {
      if (token === viewRef.current) setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, nextCursor]);

  const upsertConversation = useCallback((conversation) => {
    setConversations((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)]);
  }, []);

  const sendMessage = useCallback(
    async (text, retryOf) => {
      const content = text.trim();
      if (!content || sendingRef.current) return false;
      sendingRef.current = true;

      const token = viewRef.current;
      const targetId = loadedIdRef.current ?? null;
      const tempId = retryOf?.id ?? `temp-${createClientMessageId()}`;
      const clientMessageId = retryOf?.clientMessageId ?? createClientMessageId();
      setPendingView(token);

      if (retryOf) {
        setMessages((list) =>
          list.map((m) => (m.id === tempId ? { ...m, status: 'sending', error: undefined } : m)),
        );
      } else {
        setMessages((list) => [
          ...list,
          {
            id: tempId,
            role: 'user',
            content,
            clientMessageId,
            status: 'sending',
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      try {
        const data = await chatApi.sendMessage({ message: content, conversationId: targetId, clientMessageId });
        upsertConversation(data.conversation);
        if (viewRef.current === token) {
          const replaced = new Set([tempId, data.userMessage.id, data.assistantMessage.id]);
          setActiveConversation(data.conversation);
          setMessages((list) => [
            ...list.filter((m) => !replaced.has(m.id)),
            data.userMessage,
            data.assistantMessage,
          ]);
          if (!targetId) {
            loadedIdRef.current = data.conversation.id;
            navigate(`/chat/${data.conversation.id}`, { replace: true });
          }
        }
        return true;
      } catch (err) {
        if (viewRef.current === token) {
          const error = getErrorMessage(err, 'Message failed to send.');
          setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, status: 'failed', error } : m)));
        }
        return false;
      } finally {
        sendingRef.current = false;
        setPendingView(null);
      }
    },
    [navigate, upsertConversation],
  );

  const retryMessage = useCallback(
    (messageId) => {
      const message = messagesRef.current.find((m) => m.id === messageId && m.status === 'failed');
      if (message) return sendMessage(message.content, message);
      return Promise.resolve(false);
    },
    [sendMessage],
  );

  const deleteConversation = useCallback(
    async (id) => {
      await chatApi.deleteConversation(id);
      setConversations((list) => list.filter((c) => c.id !== id));
      setHistoryMeta((meta) => (meta ? { ...meta, total: Math.max(0, meta.total - 1) } : meta));
      if (loadedIdRef.current === id) navigate('/chat', { replace: true });
    },
    [navigate],
  );

  const startNewConversation = useCallback(() => navigate('/chat'), [navigate]);

  const value = useMemo(
    () => ({
      conversations,
      historyStatus,
      historyError,
      historyMeta,
      loadingMoreHistory,
      loadHistory,
      loadMoreHistory,
      activeConversationId: conversationId ?? null,
      activeConversation,
      messages,
      messagesStatus,
      messagesError,
      hasMore,
      loadingOlder,
      loadOlderMessages,
      reloadMessages,
      isSending: pendingView !== null,
      isTyping: pendingView !== null && pendingView === view,
      sendMessage,
      retryMessage,
      deleteConversation,
      startNewConversation,
    }),
    [
      conversations,
      historyStatus,
      historyError,
      historyMeta,
      loadingMoreHistory,
      loadHistory,
      loadMoreHistory,
      conversationId,
      activeConversation,
      messages,
      messagesStatus,
      messagesError,
      hasMore,
      loadingOlder,
      loadOlderMessages,
      reloadMessages,
      pendingView,
      view,
      sendMessage,
      retryMessage,
      deleteConversation,
      startNewConversation,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
