import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi.js';
import { setUnauthorizedHandler } from '../api/http.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  // True after an explicit logout, so guards do not remember the previous page.
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('anonymous');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const authenticate = useCallback((nextUser) => {
    setUser(nextUser);
    setSignedOut(false);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const login = useCallback(
    async (email, password) => authenticate(await authApi.login(email, password)),
    [authenticate],
  );

  const signup = useCallback(
    async (details) => authenticate(await authApi.signup(details)),
    [authenticate],
  );

  // Only drop local state once the server has cleared the HttpOnly cookie (or the session is
  // already gone); otherwise the UI would look signed out while the session stays valid.
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      if (err?.response?.status !== 401) throw err;
    }
    setSignedOut(true);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ user, status, signedOut, login, signup, logout }),
    [user, status, signedOut, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
