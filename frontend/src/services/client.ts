/**
 * Typed API client — the go-forward pattern for every KAYA endpoint.
 *
 * It wraps the configured axios instance (`src/api.ts`), so it inherits the base
 * URL (VITE_API_URL), JWT injection, and 401 auto-logout. New endpoints get a
 * typed home here instead of scattering `api.get('/api/v1/...')` strings across
 * pages. See ./README.md for how to add an endpoint.
 */
import api from '../api';
import type { AxiosRequestConfig } from 'axios';

/** A discriminated result so callers never have to try/catch for expected errors. */
export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError; status: number };

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

function toError(e: any): { error: ApiError; status: number } {
  const status = e?.response?.status ?? 0;
  const detail = e?.response?.data?.detail;
  const message =
    (typeof detail === 'string' && detail) ||
    e?.response?.data?.message ||
    e?.message ||
    'Request failed';
  return { error: { message, code: e?.code, details: e?.response?.data }, status };
}

export async function request<T>(config: AxiosRequestConfig): Promise<ApiResult<T>> {
  try {
    const res = await api.request<T>(config);
    return { ok: true, data: res.data, status: res.status };
  } catch (e) {
    const { error, status } = toError(e);
    return { ok: false, error, status };
  }
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'DELETE', url }),
};

/** Central registry of API path builders — one source of truth for URLs. */
export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    me: '/me',
  },
  patients: {
    me: '/api/v1/patients/me',
    byId: (id: string) => `/api/v1/patients/${id}`,
  },
  triage: {
    history: '/api/v1/triage/history',
    start: '/api/v1/triage/start',
  },
  consultations: {
    mine: '/api/v1/consultations/me',
    byId: (id: string) => `/api/v1/consultations/${id}`,
  },
  dashboard: {
    patientState: '/api/v1/dashboard/patient-state',
  },
  notifications: {
    unreadCount: '/api/v1/notifications/unread-count',
  },
} as const;
