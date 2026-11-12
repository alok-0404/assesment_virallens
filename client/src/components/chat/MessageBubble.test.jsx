import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageBubble from './MessageBubble.jsx';

const base = { id: 'm1', createdAt: '2026-11-11T10:00:00Z' };

// userEvent.setup() installs its own clipboard stub, so mock after calling it.
function setupWithClipboard() {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return { user, writeText };
}

describe('MessageBubble', () => {
  it('renders user messages as plain text on the right', () => {
    render(<MessageBubble message={{ ...base, role: 'user', content: '**not bold** <b>x</b>' }} />);
    const bubble = screen.getByTestId('message');
    expect(bubble).toHaveAttribute('data-role', 'user');
    expect(bubble).toHaveTextContent('**not bold** <b>x</b>');
    expect(bubble.querySelector('strong')).toBeNull();
  });

  it('renders assistant Markdown including lists, links and code blocks', () => {
    const content = [
      'Here are the **steps**:',
      '',
      '1. Open [your orders](https://example.com/orders)',
      '2. Click `Return`',
      '',
      '```js',
      'console.log("hi");',
      '```',
    ].join('\n');
    render(<MessageBubble message={{ ...base, role: 'assistant', content }} />);

    const bubble = screen.getByTestId('message');
    expect(bubble).toHaveAttribute('data-role', 'assistant');
    expect(within(bubble).getByText('steps').tagName).toBe('STRONG');
    expect(within(bubble).getAllByRole('listitem')).toHaveLength(2);
    const link = within(bubble).getByRole('link', { name: 'your orders' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(bubble).getByText('Return')).toHaveClass('md-inline-code');
    expect(within(bubble).getByText('js')).toBeInTheDocument();
    expect(bubble.querySelector('pre code')).toHaveTextContent('console.log("hi");');
  });

  it('does not render raw HTML from the model', () => {
    render(
      <MessageBubble
        message={{ ...base, role: 'assistant', content: 'Hi <img src=x onerror="alert(1)"> <script>alert(1)</script>' }}
      />,
    );
    const bubble = screen.getByTestId('message');
    expect(bubble.querySelector('img')).toBeNull();
    expect(bubble.querySelector('script')).toBeNull();
  });

  it('neutralises javascript: and data: links from the model', () => {
    const content = '[click](javascript:alert(1)) and [data](data:text/html;base64,PHNjcmlwdD4=)';
    render(<MessageBubble message={{ ...base, role: 'assistant', content }} />);
    const bubble = screen.getByTestId('message');
    for (const anchor of bubble.querySelectorAll('a')) {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/^\s*(javascript|data):/i);
    }
  });

  it('copies an assistant response', async () => {
    const { user, writeText } = setupWithClipboard();
    render(<MessageBubble message={{ ...base, role: 'assistant', content: 'Copy me' }} />);
    await user.click(screen.getByRole('button', { name: 'Copy response' }));
    expect(writeText).toHaveBeenCalledWith('Copy me');
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('copies a code block', async () => {
    const { user, writeText } = setupWithClipboard();
    render(<MessageBubble message={{ ...base, role: 'assistant', content: '```\nnpm test\n```' }} />);
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(writeText).toHaveBeenCalledWith('npm test');
  });

  it('reports a clipboard failure', async () => {
    const { user, writeText } = setupWithClipboard();
    writeText.mockRejectedValue(new Error('denied'));
    render(<MessageBubble message={{ ...base, role: 'assistant', content: 'x' }} />);
    await user.click(screen.getByRole('button', { name: 'Copy response' }));
    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
  });

  it('shows a sending state for pending messages', () => {
    render(<MessageBubble message={{ ...base, role: 'user', content: 'hi', status: 'sending' }} />);
    expect(screen.getByText('Sending…')).toBeInTheDocument();
  });

  it('shows the error and a retry button for failed messages', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageBubble
        message={{ ...base, role: 'user', content: 'hi', status: 'failed', error: 'AI service timed out.' }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('AI service timed out.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith('m1');
  });
});
