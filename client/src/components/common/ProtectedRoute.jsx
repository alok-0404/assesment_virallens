import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { FullPageSpinner } from './Spinner.jsx';

export default function ProtectedRoute({ children }) {
  const { status, signedOut } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Restoring your session…" />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={signedOut ? undefined : { from: location }} />;
  }
  return children;
}
