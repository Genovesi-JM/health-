import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api, { persistSession, clearSession, getSession } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (data: { access_token: string; refresh_token?: string; user: User }) => void;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<User>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, token: null, login: () => {}, logout: () => {},
  loading: true, refreshUser: async () => { throw new Error('AuthProvider is missing'); },
});

function userFromResponse(me: User & { user_id?: string; full_name?: string }): User {
  return {
    id: me.id || me.user_id || '',
    email: me.email,
    role: me.role,
    is_active: me.is_active !== false,
    name: me.name || me.full_name,
    professional_application: me.professional_application ?? null,
    patient_onboarding_complete: me.patient_onboarding_complete,
  };
}

function cacheUser(user: User) {
  localStorage.setItem('ht_user', JSON.stringify(user));
  localStorage.setItem('ht_email', user.email);
  localStorage.setItem('ht_name', user.name || '');
  localStorage.setItem('ht_role', user.role);
  localStorage.setItem('ht_user_id', String(user.id));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* Restore session from localStorage */
  useEffect(() => {
    const session = getSession();
    if (session) {
      // Cached roles and completion flags are not authoritative after a reload.
      api.get('/auth/me')
        .then(r => {
          const fresh = userFromResponse(r.data);
          setToken(session.token);
          setUser(fresh);
          cacheUser(fresh);
        })
        .catch(() => {
          setToken(null);
          setUser(null);
        })
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
    cacheUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await api.get('/auth/me');
    const fresh = userFromResponse(r.data);
    setUser(fresh);
    cacheUser(fresh);
    return fresh;
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
