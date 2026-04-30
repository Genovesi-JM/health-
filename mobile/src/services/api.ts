/**
 * API service for Health Platform mobile app.
 * Uses axios with Bearer token from SecureStore.
 *
 * Base URL is read from EXPO_PUBLIC_API_BASE_URL env var (falls back to localhost).
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

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
  (error: AxiosError<{ detail?: string }>) => {
    // Attach a human-readable message to the error so screens can use
    // err.message as a fallback instead of drilling into err.response?.data
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === 'string') {
      error.message = detail;
    }
    return Promise.reject(error);
  },
);

// ----- Token helpers -----

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('access_token', token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync('access_token');
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}

export default api;
