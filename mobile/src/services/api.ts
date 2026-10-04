/**
 * API service for KAYA mobile app.
 * Uses axios with Bearer token from SecureStore.
 *
 * EXPO_PUBLIC_API_URL is required for distribution; localhost is development-only.
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { assertOperationalAccess } from '../phase1/policy';
import { resolveApiBaseUrl } from '../config/apiUrl';
import { isMfaSessionError } from '../contexts/authSession';
import { createSessionCoordinator, createSessionRefresh, SessionChangedError } from './sessionCoordinator';

const BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_API_BASE_URL,
  __DEV__,
);

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});
export const sessions = createSessionCoordinator(SecureStore);
type SessionConfig = InternalAxiosRequestConfig & { _retry?: boolean; _sessionVersion?: number };
const refreshSession = createSessionRefresh(sessions, async refreshToken => {
  assertOperationalAccess();
  const response = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 15_000 });
  return response.data;
});

// Attach JWT on every request
api.interceptors.request.use(async (config: SessionConfig) => {
  assertOperationalAccess();
  const version = config._sessionVersion ?? sessions.version();
  config._sessionVersion = version;
  const { accessToken: token } = await sessions.snapshot(version);
  sessions.assertCurrent(version);
  if (token && config.headers && !config.headers.Authorization) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Normalise API errors so callers get a consistent shape
api.interceptors.response.use(
  response => {
    sessions.assertCurrent((response.config as SessionConfig)._sessionVersion ?? sessions.version());
    return response;
  },
  async (error: AxiosError<{ detail?: string }>) => {
    // Attach a human-readable message to the error so screens can use
    // err.message as a fallback instead of drilling into err.response?.data
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === 'string') {
      error.message = detail;
    }
    const original = error.config as SessionConfig | undefined;
    const version = original?._sessionVersion;
    if (version !== undefined && !sessions.current(version)) throw new SessionChangedError();
    const isAuthStep = ['/auth/login', '/auth/register', '/auth/mfa/'].some(path => original?.url?.includes(path));
    if (version !== undefined && isMfaSessionError(error)) {
      await sessions.invalidate(version);
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && original && !original._retry && !isAuthStep && !isMfaSessionError(error)) {
      assertOperationalAccess();
      original._retry = true;
      try {
        const accessToken = await refreshSession(version ?? sessions.version());
        if (version !== undefined) sessions.assertCurrent(version);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api.request(original);
      } catch {
        if (version !== undefined) await sessions.invalidate(version);
      }
    }
    return Promise.reject(error);
  },
);

// ----- Token helpers -----

export async function saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await sessions.replace(accessToken, refreshToken);
}

export async function clearToken(): Promise<void> {
  await sessions.invalidate();
}

export async function getToken(): Promise<string | null> {
  return (await sessions.snapshot()).accessToken;
}

export default api;
