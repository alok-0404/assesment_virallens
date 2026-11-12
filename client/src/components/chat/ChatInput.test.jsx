import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from './ChatInput.jsx';

function setup(props = {}) {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} {...props} />);
  return { onSend, textarea: screen.getByLabelText('Message'), sendButton: screen.getByRole('button', { name: 'Send message' }) };
}

describe('ChatInput', () => {
  it('sends trimmed text on Enter and clears the input', async () => {
    const user = userEvent.setup();
    const { onSend, textarea } = setup();
    await user.type(textarea, '  Where is my order?  {Enter}');
    expect(onSend).toHaveBeenCalledWith('Where is my order?');
    expect(textarea).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter without sending', async () => {
    const user = userEvent.setup();
    const { onSend, textarea } = setup();
    await user.type(textarea, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('line one\nline two');
    await user.type(textarea, '{Enter}');
    expect(onSend).toHaveBeenCalledWith('line one\nline two');
  });

  it('sends with the send button', async () => {
    const user = userEvent.setup();
    const { onSend, textarea, sendButton } = setup();
    expect(sendButton).toBeDisabled();
    await user.type(textarea, 'Hello');
    expect(sendButton).toBeEnabled();
    await user.click(sendButton);
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('does not send empty or whitespace-only messages', async () => {
    const user = userEvent.setup();
    const { onSend, textarea } = setup();
    await user.type(textarea, '    {Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('blocks sending while a reply is pending', async () => {
    const user = userEvent.setup();
    const { onSend, textarea, sendButton } = setup({ sending: true });
    await user.type(textarea, 'Another one{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(sendButton).toBeDisabled();
    expect(textarea).toHaveValue('Another one');
  });

  it('disables the textarea when disabled', () => {
    const { textarea } = setup({ disabled: true });
    expect(textarea).toBeDisabled();
  });

  it('shows a counter near the limit and blocks over-long messages', () => {
    const { onSend, textarea, sendButton } = setup();
    fireEvent.change(textarea, { target: { value: 'a'.repeat(3600) } });
    expect(screen.getByText('3600/4000')).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4001) } });
    expect(screen.getByText('4001/4000')).toHaveClass('text-red-600');
    expect(sendButton).toBeDisabled();
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });
});
