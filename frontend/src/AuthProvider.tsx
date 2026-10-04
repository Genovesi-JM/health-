import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import api, { persistSession, clearSession, getSession } from './api';
import type { User } from './types';
import { AuthContext } from './authContextState';

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
  const [loading, setLoading] = useState(() => Boolean(getSession()));
  const sessionVersion = useRef(0);
  const advanceSession = useCallback(() => ++sessionVersion.current, []);

  /* Restore session from localStorage */
  useEffect(() => {
    const version = advanceSession();
    const session = getSession();
    if (session) {
      // Cached roles and completion flags are not authoritative after a reload.
      api.get('/auth/me')
        .then(r => {
          if (sessionVersion.current !== version || getSession()?.token !== session.token) return;
          const fresh = userFromResponse(r.data);
          setToken(session.token);
          setUser(fresh);
          cacheUser(fresh);
        })
        .catch(() => {
          if (sessionVersion.current !== version) return;
          setToken(null);
          setUser(null);
        })
        .finally(() => { if (sessionVersion.current === version) setLoading(false); });
    }
    // Other tabs share localStorage. Immediately remove the previous account's
    // clinical view before resolving the identity associated with a new token.
    const onStorage = (event: StorageEvent) => {
      if ((event.storageArea && event.storageArea !== localStorage) || (event.key !== 'ht_token' && event.key !== null)) return;
      const changedVersion = advanceSession();
      const changedSession = getSession();
      setUser(null); setToken(null); setLoading(Boolean(changedSession));
      if (!changedSession) return;
      api.get('/auth/me').then(r => {
        if (sessionVersion.current !== changedVersion || getSession()?.token !== changedSession.token) return;
        const fresh = userFromResponse(r.data);
        setToken(changedSession.token); setUser(fresh); cacheUser(fresh);
      }).catch(() => {
        // The view was already cleared. Keep it clear on an unverified identity.
      }).finally(() => { if (sessionVersion.current === changedVersion) setLoading(false); });
    };
    window.addEventListener('storage', onStorage);
    return () => { advanceSession(); window.removeEventListener('storage', onStorage); };
  }, [advanceSession]);

  const login = useCallback((data: { access_token: string; refresh_token?: string; user: User }) => {
    sessionVersion.current++;
    persistSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: { id: String(data.user.id), email: data.user.email, role: data.user.role, name: data.user.name },
    });
    setToken(data.access_token);
    setUser(data.user);
    setLoading(false);
    cacheUser(data.user);
  }, []);

  const logout = useCallback(() => {
    sessionVersion.current++;
    clearSession();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const version = sessionVersion.current;
    const session = getSession();
    if (!session) throw new Error('A sessão terminou. Inicie sessão novamente.');
    const r = await api.get('/auth/me');
    if (sessionVersion.current !== version || getSession()?.token !== session.token) {
      throw new Error('A sessão mudou durante a atualização.');
    }
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
