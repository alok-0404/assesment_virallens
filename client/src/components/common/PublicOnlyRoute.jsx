import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { FullPageSpinner } from './Spinner.jsx';

export function redirectTarget(location) {
  const from = location.state?.from;
  return from?.pathname ? `${from.pathname}${from.search ?? ''}` : '/chat';
}

export default function PublicOnlyRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to={redirectTarget(location)} replace />;
  return children;
}
