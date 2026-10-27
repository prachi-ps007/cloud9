import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const clear = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {
        /* 401 handler already cleared; network errors leave the user logged out of the UI */
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [clear]);

  const startSession = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (username, password, deviceName) =>
        startSession(await api.post('/auth/login', { username, password, deviceName })),
      register: async (username, password, deviceName) =>
        startSession(await api.post('/auth/register', { username, password, deviceName })),
      startSession,
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          /* ignore - we clear locally either way */
        }
        clear();
      },
    }),
    [user, loading, startSession, clear]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
