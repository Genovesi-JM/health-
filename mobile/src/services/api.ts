/**
 * API service for KAYA mobile app.
 * Uses axios with Bearer token from SecureStore.
 *
 * Base URL is read from EXPO_PUBLIC_API_BASE_URL env var (falls back to localhost).
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});
let refreshPromise: Promise<string> | null = null;

// Attach JWT on every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Normalise API errors so callers get a consistent shape
api.interceptors.response.use(
  response => response,
  async (error: AxiosError<{ detail?: string }>) => {
    // Attach a human-readable message to the error so screens can use
    // err.message as a fallback instead of drilling into err.response?.data
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === 'string') {
      error.message = detail;
    }
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = await SecureStore.getItemAsync('refresh_token');
            if (!refreshToken) throw new Error('No refresh token');
            const response = await axios.post(`${BASE_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            }, { timeout: 15_000 });
            const storedUser = await SecureStore.getItemAsync('auth_user');
            const updatedUser = storedUser
              ? {
                  ...JSON.parse(storedUser),
                  access_token: response.data.access_token,
                  refresh_token: response.data.refresh_token,
                }
              : null;
            await Promise.all([
              SecureStore.setItemAsync('access_token', response.data.access_token),
              SecureStore.setItemAsync('refresh_token', response.data.refresh_token),
              ...(updatedUser
                ? [SecureStore.setItemAsync('auth_user', JSON.stringify(updatedUser))]
                : []),
            ]);
            return response.data.access_token as string;
          })().finally(() => { refreshPromise = null; });
        }
        const accessToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api.request(original);
      } catch {
        await Promise.all([
          SecureStore.deleteItemAsync('access_token'),
          SecureStore.deleteItemAsync('refresh_token'),
          SecureStore.deleteItemAsync('auth_user'),
          SecureStore.deleteItemAsync('kaya_health_connection_owner'),
        ]);
      }
    }
    return Promise.reject(error);
  },
);

// ----- Token helpers -----

export async function saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync('access_token', accessToken);
  if (refreshToken) await SecureStore.setItemAsync('refresh_token', refreshToken);
}

export async function clearToken(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync('access_token'),
    SecureStore.deleteItemAsync('refresh_token'),
  ]);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}

export default api;
