import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, axiosError } from '../test/renderApp.jsx';
import { authApi } from '../api/authApi.js';
import { chatApi } from '../api/chatApi.js';

vi.mock('../api/authApi.js', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() },
}));
vi.mock('../api/chatApi.js', () => ({
  chatApi: {
    getHistory: vi.fn(),
    getConversation: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    deleteConversation: vi.fn(),
  },
}));

const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00Z' };
const now = new Date().toISOString();
const conv = (id, title) => ({ id, title, lastMessageAt: now, messageCount: 2, createdAt: now, updatedAt: now });
const msg = (id, conversationId, role, content) => ({ id, conversationId, role, content, createdAt: now });

const c1 = conv('c1', 'Late delivery');
const c2 = conv('c2', 'Refund request');
const messagesByConversation = {
  c1: [msg('m1', 'c1', 'user', 'My order is late'), msg('m2', 'c1', 'assistant', 'Sorry to hear that!')],
  c2: [msg('m3', 'c2', 'user', 'I want a refund'), msg('m4', 'c2', 'assistant', 'Let me help with your refund.')],
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  authApi.me.mockResolvedValue(ada);
  authApi.logout.mockResolvedValue({ loggedOut: true });
  chatApi.getHistory.mockResolvedValue({
    conversations: [c1, c2],
    meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
  });
  chatApi.getConversation.mockImplementation(async (id) => {
    const found = [c1, c2].find((c) => c.id === id);
    if (!found) throw axiosError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    return found;
  });
  chatApi.getMessages.mockImplementation(async (id) => ({
    messages: messagesByConversation[id] ?? [],
    hasMore: false,
    nextCursor: null,
  }));
});

const getSidebar = () => screen.findByRole('complementary', { name: 'Conversations' });

describe('Chat dashboard', () => {
  it('renders the sidebar with history, user info and the welcome state', async () => {
    renderApp('/chat');
    expect(await screen.findByRole('heading', { name: 'Hi Ada, how can we help today?' })).toBeInTheDocument();
    expect(await within((await getSidebar())).findByRole('button', { name: /^Late delivery/ })).toBeInTheDocument();
    expect(within((await getSidebar())).getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New conversation' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /order|refund|charged|address/i }).length).toBeGreaterThanOrEqual(4);
  });

  it('shows an empty history message', async () => {
    chatApi.getHistory.mockResolvedValue({
      conversations: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
    });
    renderApp('/chat');
    expect(await screen.findByText('No conversations yet. Start one to see it here.')).toBeInTheDocument();
  });

  it('shows a history error with retry', async () => {
    chatApi.getHistory.mockRejectedValueOnce(axiosError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.'));
    const user = userEvent.setup();
    renderApp('/chat');
    const alert = await within((await getSidebar())).findByRole('alert');
    expect(alert).toHaveTextContent('An unexpected error occurred.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await within((await getSidebar())).findByRole('button', { name: /^Late delivery/ })).toBeInTheDocument();
  });

  it('selects a conversation from the sidebar and shows its messages', async () => {
    const user = userEvent.setup();
    renderApp('/chat');
    await user.click(await within((await getSidebar())).findByRole('button', { name: /^Refund request/ }));

    expect(await screen.findByText('Let me help with your refund.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Refund request' })).toBeInTheDocument();
    expect(within((await getSidebar())).getByRole('button', { name: /^Refund request/ })).toHaveAttribute('aria-current', 'page');
    expect(chatApi.getMessages).toHaveBeenCalledWith('c2', expect.objectContaining({ limit: 50 }));
  });

  it('restores the conversation from the URL (page refresh)', async () => {
    renderApp('/chat/c1');
    expect(await screen.findByText('Sorry to hear that!')).toBeInTheDocument();
    expect(screen.getByText('My order is late')).toBeInTheDocument();
  });

  it('shows a not-found state for unknown or foreign conversations', async () => {
    renderApp('/chat/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Conversation not found' })).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeDisabled();
  });

  it('sends a message: optimistic bubble, typing indicator, then the AI reply', async () => {
    const pending = deferred();
    chatApi.sendMessage.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderApp('/chat');
    await screen.findByRole('heading', { name: /how can we help/ });

    await user.type(screen.getByLabelText('Message'), 'Where is my parcel?{Enter}');

    expect(screen.getByText('Where is my parcel?')).toBeInTheDocument();
    expect(screen.getByText('Assistant is typing…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    const call = chatApi.sendMessage.mock.calls[0][0];
    expect(call).toMatchObject({ message: 'Where is my parcel?', conversationId: null });
    expect(call.clientMessageId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);

    const created = conv('c3', 'Where is my parcel?');
    await act(async () => {
      pending.resolve({
        conversation: created,
        userMessage: msg('m5', 'c3', 'user', 'Where is my parcel?'),
        assistantMessage: msg('m6', 'c3', 'assistant', 'Let me check that for you.'),
      });
    });

    expect(await screen.findByText('Let me check that for you.')).toBeInTheDocument();
    expect(screen.queryByText('Assistant is typing…')).not.toBeInTheDocument();
    expect(screen.getAllByText('Where is my parcel?').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('message')).toHaveLength(2);
    // New conversation appears at the top of the sidebar and becomes active without reloading.
    const items = within((await getSidebar())).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Where is my parcel?');
    expect(chatApi.getMessages).not.toHaveBeenCalledWith('c3', expect.anything());
  });

  it('continues an existing conversation with its id', async () => {
    chatApi.sendMessage.mockResolvedValue({
      conversation: { ...c1, messageCount: 4 },
      userMessage: msg('m7', 'c1', 'user', 'Any update?'),
      assistantMessage: msg('m8', 'c1', 'assistant', 'It ships tomorrow.'),
    });
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await screen.findByText('Sorry to hear that!');
    await user.type(screen.getByLabelText('Message'), 'Any update?{Enter}');
    expect(await screen.findByText('It ships tomorrow.')).toBeInTheDocument();
    expect(chatApi.sendMessage.mock.calls[0][0]).toMatchObject({ conversationId: 'c1', message: 'Any update?' });
    expect(screen.getAllByTestId('message')).toHaveLength(4);
  });

  it('marks a failed message and retries it with the same idempotency key', async () => {
    chatApi.sendMessage.mockRejectedValueOnce(
      axiosError(504, 'AI_TIMEOUT', 'AI service timed out. Please try again.'),
    );
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await screen.findByText('Sorry to hear that!');
    await user.type(screen.getByLabelText('Message'), 'Hello?{Enter}');

    const alert = await screen.findByText('AI service timed out. Please try again.');
    expect(alert).toBeInTheDocument();
    const firstKey = chatApi.sendMessage.mock.calls[0][0].clientMessageId;

    chatApi.sendMessage.mockResolvedValueOnce({
      conversation: c1,
      userMessage: msg('m9', 'c1', 'user', 'Hello?'),
      assistantMessage: msg('m10', 'c1', 'assistant', 'Hi again!'),
    });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Hi again!')).toBeInTheDocument();
    expect(chatApi.sendMessage.mock.calls[1][0].clientMessageId).toBe(firstKey);
    expect(screen.queryByText('AI service timed out. Please try again.')).not.toBeInTheDocument();
    expect(screen.getAllByText('Hello?')).toHaveLength(1);
  });

  it('sends a suggested prompt', async () => {
    chatApi.sendMessage.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderApp('/chat');
    await user.click(await screen.findByRole('button', { name: 'How do I return an item and get a refund?' }));
    expect(chatApi.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'How do I return an item and get a refund?' }),
    );
  });

  it('does not inject a late reply into a different conversation (rapid switching)', async () => {
    const pending = deferred();
    chatApi.sendMessage.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await screen.findByText('Sorry to hear that!');
    await user.type(screen.getByLabelText('Message'), 'Slow question{Enter}');

    await user.click(within((await getSidebar())).getByRole('button', { name: /^Refund request/ }));
    await screen.findByText('Let me help with your refund.');
    expect(screen.queryByText('Assistant is typing…')).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve({
        conversation: { ...c1, messageCount: 4 },
        userMessage: msg('m11', 'c1', 'user', 'Slow question'),
        assistantMessage: msg('m12', 'c1', 'assistant', 'Late answer'),
      });
    });
    expect(screen.queryByText('Late answer')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('message')).toHaveLength(2);
  });

  it('ignores a stale message load after switching quickly', async () => {
    const slow = deferred();
    chatApi.getMessages.mockImplementation((id) =>
      id === 'c1' ? slow.promise : Promise.resolve({ messages: messagesByConversation.c2, hasMore: false, nextCursor: null }),
    );
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await user.click(await within((await getSidebar())).findByRole('button', { name: /^Refund request/ }));
    await screen.findByText('Let me help with your refund.');
    await act(async () => {
      slow.resolve({ messages: messagesByConversation.c1, hasMore: false, nextCursor: null });
    });
    expect(screen.queryByText('Sorry to hear that!')).not.toBeInTheDocument();
  });

  it('deletes a conversation after confirmation', async () => {
    chatApi.deleteConversation.mockResolvedValue({ id: 'c1', deletedMessages: 2 });
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await screen.findByText('Sorry to hear that!');

    await user.click(within((await getSidebar())).getByRole('button', { name: 'Delete conversation Late delivery' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete conversation?' });
    expect(dialog).toHaveTextContent('"Late delivery" and all of its messages will be permanently deleted.');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chatApi.deleteConversation).not.toHaveBeenCalled();

    await user.click(within((await getSidebar())).getByRole('button', { name: 'Delete conversation Late delivery' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chatApi.deleteConversation).toHaveBeenCalledWith('c1');
    expect(within((await getSidebar())).queryByRole('button', { name: /^Late delivery/ })).not.toBeInTheDocument();
    // Active conversation was deleted → back to a new conversation.
    expect(await screen.findByRole('heading', { name: /how can we help/ })).toBeInTheDocument();
  });

  it('keeps the dialog open with an error when deletion fails', async () => {
    chatApi.deleteConversation.mockRejectedValue(axiosError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.'));
    const user = userEvent.setup();
    renderApp('/chat');
    await user.click(await within((await getSidebar())).findByRole('button', { name: 'Delete conversation Refund request' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('An unexpected error occurred.');
  });

  it('opens and closes the mobile sidebar drawer', async () => {
    const user = userEvent.setup();
    renderApp('/chat');
    await screen.findByRole('heading', { name: /how can we help/ });
    expect((await getSidebar())).toHaveAttribute('data-open', 'false');
    expect((await getSidebar())).toHaveClass('-translate-x-full', 'md:translate-x-0');

    await user.click(screen.getByRole('button', { name: 'Open conversations' }));
    expect((await getSidebar())).toHaveAttribute('data-open', 'true');
    expect((await getSidebar())).toHaveClass('translate-x-0');

    await user.keyboard('{Escape}');
    expect((await getSidebar())).toHaveAttribute('data-open', 'false');

    await user.click(screen.getByRole('button', { name: 'Open conversations' }));
    await user.click(within((await getSidebar())).getByRole('button', { name: /^Late delivery/ }));
    expect((await getSidebar())).toHaveAttribute('data-open', 'false');
  });

  it('starts a new chat from the sidebar', async () => {
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await screen.findByText('Sorry to hear that!');
    await user.click(within((await getSidebar())).getByRole('button', { name: /New chat/ }));
    expect(await screen.findByRole('heading', { name: /how can we help/ })).toBeInTheDocument();
    expect(screen.queryByText('Sorry to hear that!')).not.toBeInTheDocument();
  });

  it('logs out from the sidebar', async () => {
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await user.click(await within((await getSidebar())).findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('stays signed in and shows an error when logout fails on the server', async () => {
    authApi.logout.mockRejectedValue(axiosError(400, 'INVALID_JSON', 'Malformed JSON request body.'));
    const user = userEvent.setup();
    renderApp('/chat/c1');
    const sidebar = await getSidebar();
    await user.click(await within(sidebar).findByRole('button', { name: 'Log out' }));
    expect(await within(sidebar).findByRole('alert')).toHaveTextContent('Malformed JSON request body.');
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
    expect(screen.getByText('Sorry to hear that!')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Log out' })).toBeEnabled();
  });

  it('treats a 401 on logout as already signed out', async () => {
    authApi.logout.mockRejectedValue(axiosError(401, 'UNAUTHORIZED', 'Authentication required.'));
    const user = userEvent.setup();
    renderApp('/chat/c1');
    await user.click(await within(await getSidebar()).findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
