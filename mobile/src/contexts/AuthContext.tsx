import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { saveToken, clearToken } from '../services/api';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: 'patient' | 'doctor' | 'admin' | 'enterprise';
  access_token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (data: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate session from SecureStore
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('auth_user');
        if (stored) {
          const parsed: AuthUser = JSON.parse(stored);
          setUser(parsed);
          await saveToken(parsed.access_token);
        }
      } catch {
        // corrupted storage — ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (data: AuthUser) => {
    await saveToken(data.access_token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(data));
    setUser(data);
  };

  const logout = async () => {
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
