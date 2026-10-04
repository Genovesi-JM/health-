import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { sessions } from '../services/api';
import { clearHealthConnection } from '../health/healthSync';
import { normalizeAuth, mergeSessionIdentity, type AuthUser } from './authSession';
import { createAuthController } from '../services/sessionCoordinator';
import type { AxiosRequestConfig } from 'axios';
export type { AuthUser } from './authSession';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (data: AuthUser) => Promise<void>;
  refreshUser: () => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [controller] = useState(() => createAuthController({
    sessions, normalize: normalizeAuth, merge: mergeSessionIdentity,
    notify: fresh => { setUser(fresh); setLoading(false); },
    readIdentity: async version => {
      const config: AxiosRequestConfig & { _sessionVersion: number } = { _sessionVersion: version };
      return (await api.get('/auth/me', config)).data;
    },
  }));

  useEffect(() => {
    let mounted = true;
    const disconnect = controller.connect();
    void controller.restore().catch(() => {
      // A cached identity never opens protected screens without a fresh response.
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; disconnect(); };
  }, [controller]);

  return (
    <AuthContext.Provider value={{ user, loading, login: controller.login, logout: () => controller.logout(clearHealthConnection), refreshUser: controller.refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
