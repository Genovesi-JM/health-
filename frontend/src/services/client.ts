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
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';

/** A discriminated result so callers never have to try/catch for expected errors. */
export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError; status: number };

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function toError(e: unknown): { error: ApiError; status: number } {
  const thrown = record(e);
  const data = record(thrown?.response)?.data;
  const fallback = [record(data)?.message, thrown?.message]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  return {
    error: {
      message: apiErrorMessage(e, fallback || 'Request failed'),
      code: typeof thrown?.code === 'string' ? thrown.code : undefined,
      details: data,
    },
    status: apiErrorStatus(e) ?? 0,
  };
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
