import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
const CHAT_HEADING = 'Hi Ada, how can we help today?';

beforeEach(() => {
  vi.resetAllMocks();
  authApi.me.mockRejectedValue(axiosError(401, 'UNAUTHORIZED', 'Authentication required.'));
  authApi.logout.mockResolvedValue({ loggedOut: true });
  chatApi.getHistory.mockResolvedValue({
    conversations: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
  });
});

describe('Login page', () => {
  it('renders the form', async () => {
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/signup');
  });

  it('shows client-side validation errors without calling the API', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows the server message for invalid credentials', async () => {
    authApi.login.mockRejectedValue(axiosError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(authApi.login).toHaveBeenCalledWith('ada@example.com', 'wrong-pass1');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows a network error message', async () => {
    authApi.login.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server');
  });

  it('logs in and redirects to the originally requested page', async () => {
    authApi.login.mockResolvedValue(ada);
    const user = userEvent.setup();
    renderApp('/chat');
    // Redirected to login first.
    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: CHAT_HEADING })).toBeInTheDocument();
  });
});

describe('Signup page', () => {
  it('validates fields including password confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/signup');
    await user.type(await screen.findByLabelText('Full name'), 'A');
    await user.type(screen.getByLabelText('Email'), 'bad');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'other');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Name must be at least 2 characters.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it('maps a duplicate email error to the email field', async () => {
    authApi.signup.mockRejectedValue(
      axiosError(409, 'EMAIL_IN_USE', 'An account with this email already exists.'),
    );
    const user = userEvent.setup();
    renderApp('/signup');
    await user.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getAllByText('An account with this email already exists.').length).toBeGreaterThan(0);
  });

  it('creates an account and enters the app', async () => {
    authApi.signup.mockResolvedValue(ada);
    const user = userEvent.setup();
    renderApp('/signup');
    await user.type(await screen.findByLabelText('Full name'), '  Ada Lovelace ');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: CHAT_HEADING })).toBeInTheDocument();
    expect(authApi.signup).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Password1',
    });
  });
});

describe('Route protection and session restoration', () => {
  it('shows a spinner while restoring the session', () => {
    authApi.me.mockReturnValue(new Promise(() => {}));
    renderApp('/chat');
    expect(screen.getByText('Restoring your session…')).toBeInTheDocument();
  });

  it('redirects anonymous users from /chat to /login', async () => {
    renderApp('/chat');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('restores an existing session on page load (refresh)', async () => {
    authApi.me.mockResolvedValue(ada);
    renderApp('/chat');
    expect(await screen.findByRole('heading', { name: CHAT_HEADING })).toBeInTheDocument();
  });

  it('redirects authenticated users away from /login', async () => {
    authApi.me.mockResolvedValue(ada);
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: CHAT_HEADING })).toBeInTheDocument();
  });

  it('logs out and redirects to the login page', async () => {
    authApi.me.mockResolvedValue(ada);
    const user = userEvent.setup();
    renderApp('/chat');
    await user.click(await screen.findByRole('button', { name: /log out/i }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });

  it('renders a 404 page for unknown routes', async () => {
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
