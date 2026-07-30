import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { saveTokens, clearToken } from '../services/api';
import { disconnectHealth } from '../health/healthSync';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'patient' | 'doctor' | 'nurse' | 'admin' | 'enterprise' | string;
  access_token: string;
  refresh_token?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (data: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeAuth(data: any): AuthUser {
  const source = data?.user ?? data;
  return {
    id: String(source.id),
    email: source.email,
    full_name: source.full_name ?? source.name ?? '',
    role: source.role,
    access_token: data.access_token ?? source.access_token,
    refresh_token: data.refresh_token ?? source.refresh_token,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate session from SecureStore
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('auth_user');
        if (stored) {
          const parsed = normalizeAuth(JSON.parse(stored));
          setUser(parsed);
          await saveTokens(parsed.access_token, parsed.refresh_token);
        }
      } catch {
        // corrupted storage — ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (data: AuthUser) => {
    const normalized = normalizeAuth(data);
    await saveTokens(normalized.access_token, normalized.refresh_token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(normalized));
    setUser(normalized);
  };

  const logout = async () => {
    await disconnectHealth();
    await clearToken();
    await SecureStore.deleteItemAsync('auth_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
