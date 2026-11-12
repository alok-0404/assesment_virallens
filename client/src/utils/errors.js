import axios from 'axios';

const MESSAGES = {
  NETWORK: 'Unable to reach the server. Check your connection and try again.',
  TIMEOUT: 'The request took too long. Please try again.',
};

export function getErrorCode(error) {
  if (axios.isCancel(error)) return 'CANCELLED';
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'TIMEOUT';
  if (!error?.response) return 'NETWORK';
  return error.response.data?.error?.code ?? `HTTP_${error.response.status}`;
}

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const code = getErrorCode(error);
  if (MESSAGES[code]) return MESSAGES[code];
  return error?.response?.data?.error?.message || fallback;
}

/** Maps server validation details ([{ path, message }]) to { field: message }. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((d) => d.path).map((d) => [d.path, d.message]));
}
