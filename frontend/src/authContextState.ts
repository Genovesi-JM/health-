import { createContext } from 'react';
import type { User } from './types';

export interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (data: { access_token: string; refresh_token?: string; user: User }) => void;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<User>;
}

export const AuthContext = createContext<AuthCtx>({
  user: null, token: null, login: () => {}, logout: () => {},
  loading: true, refreshUser: async () => { throw new Error('AuthProvider is missing'); },
});
