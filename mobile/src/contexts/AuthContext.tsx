import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { saveTokens, clearToken } from '../services/api';
import { disconnectHealth } from '../health/healthSync';
import { normalizeAuth, mergeSessionIdentity, isMfaSessionError, type AuthUser } from './authSession';
export type { AuthUser } from './authSession';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (data: AuthUser) => Promise<void>;
  refreshUser: () => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function freshSession(session: AuthUser): Promise<AuthUser> {
  const response = await api.get('/auth/me');
  // The API may have refreshed expired tokens while loading the identity.
  const accessToken = await SecureStore.getItemAsync('access_token');
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  const fresh = mergeSessionIdentity({
    ...session,
    access_token: accessToken || session.access_token,
    refresh_token: refreshToken || session.refresh_token,
  }, response.data);
  await SecureStore.setItemAsync('auth_user', JSON.stringify(fresh));
  return fresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const expireSession = useCallback(async () => {
    setUser(null);
    await Promise.all([clearToken(), SecureStore.deleteItemAsync('auth_user')]);
  }, []);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(response => response, async error => {
      if (isMfaSessionError(error)) await expireSession();
      return Promise.reject(error);
    });
    return () => api.interceptors.response.eject(interceptor);
  }, [expireSession]);

  useEffect(() => {
    // Rehydrate session from SecureStore
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('auth_user');
        if (stored) {
          const parsed = normalizeAuth(JSON.parse(stored));
          await saveTokens(parsed.access_token, parsed.refresh_token);
          try {
            setUser(await freshSession(parsed));
          } catch (error: any) {
            if (error.response?.status === 401 || isMfaSessionError(error)) await expireSession();
            // Keep stored tokens for a future retry, but never open operational
            // screens from unverified cached role or onboarding metadata.
            else setUser(null);
          }
        }
      } catch {
        // corrupted storage — ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [expireSession]);

  const login = async (data: AuthUser) => {
    const normalized = normalizeAuth(data);
    await saveTokens(normalized.access_token, normalized.refresh_token);
    setUser(await freshSession(normalized));
  };

  const refreshUser = useCallback(async () => {
    if (!user) throw new Error('Sign in again to continue.');
    const fresh = await freshSession(user);
    setUser(fresh);
    return fresh;
  }, [user]);

  const logout = useCallback(async () => {
    try { await disconnectHealth(); } finally { await expireSession(); }
  }, [expireSession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
