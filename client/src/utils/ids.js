/** Idempotency key for a message send; matches the server pattern [A-Za-z0-9_-]{8,64}. */
export function createClientMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
