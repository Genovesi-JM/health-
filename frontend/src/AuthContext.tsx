import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api, { persistSession, clearSession, getSession } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (data: { access_token: string; refresh_token?: string; user: User }) => void;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, token: null, login: () => {}, logout: () => {},
  loading: true, refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* Restore session from localStorage */
  useEffect(() => {
    const session = getSession();
    if (session) {
      setToken(session.token);
      try {
        const u = JSON.parse(localStorage.getItem('ht_user') || '{}');
        setUser(u);
      } catch { /* ignore */ }

      /* Verify token is still valid by calling /auth/me */
      api.get('/auth/me')
        .then(r => {
          const me = r.data;
          const fresh: User = {
            id: me.id || me.user_id,
            email: me.email,
            role: me.role,
            is_active: me.is_active !== false,
            name: me.name || me.full_name,
          };
          setUser(fresh);
          localStorage.setItem('ht_user', JSON.stringify(fresh));
          if (me.email) localStorage.setItem('ht_email', me.email);
          if (me.name) localStorage.setItem('ht_name', me.name);
          if (me.role) localStorage.setItem('ht_role', me.role);
        })
        .catch(() => { /* token may be expired — interceptor handles 401 */ })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((data: { access_token: string; refresh_token?: string; user: User }) => {
    persistSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: { id: String(data.user.id), email: data.user.email, role: data.user.role, name: data.user.name },
    });
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const r = await api.get('/auth/me');
      const me = r.data;
      const fresh: User = {
        id: me.id || me.user_id,
        email: me.email,
        role: me.role,
        is_active: me.is_active !== false,
        name: me.name || me.full_name,
      };
      setUser(fresh);
      localStorage.setItem('ht_user', JSON.stringify(fresh));
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
