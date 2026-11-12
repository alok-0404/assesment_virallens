import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';

export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

export function axiosError(status, code, message, details) {
  const error = new Error(message);
  error.isAxiosError = true;
  error.response = { status, data: { success: false, error: { code, message, details } } };
  return error;
}
