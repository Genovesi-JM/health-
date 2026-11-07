import axios from 'axios';
import { clearPendingAppointments } from './utils/pendingAppointment';
import { assertOperationalAccess } from './phase1/policy';

/*
 * In dev the Vite proxy forwards /auth, /api, etc. to localhost:8000.
 * In production (GitHub Pages) we hit the Render backend directly via
 * the VITE_API_URL env var that is injected at build time.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  // A dead or unreachable API must fail fast; the UI shows a clear message instead of spinning.
  timeout: 12000,
});

// Attach JWT to every request. Never override an Authorization header that the
// caller set explicitly (e.g. a short-lived MFA enrollment token during login).
api.interceptors.request.use((config) => {
  assertOperationalAccess();
  if (config.headers.Authorization) {
    return config;
  }
  const token = localStorage.getItem('ht_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Approval can promote an applicant on the server while an older session still
// lacks MFA. Only explicit server MFA codes on 403 trigger reauthentication.
export function requiresReauthentication(status: number | undefined, errorCode: unknown, url: string): boolean {
  const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');
  if (status === 401) return !isAuthRoute;
  return status === 403 && ['mfa_enrollment_required', 'mfa_verification_required'].includes(String(errorCode));
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const errorCode = err.response?.headers?.['x-kaya-error-code'];
    // A response belongs to the credential sent with that request. An expired
    // previous account (or a separate MFA challenge) cannot clear a newer login.
    const currentToken = localStorage.getItem('ht_token');
    const requestAuthorization = err.config?.headers?.Authorization;
    const isCurrentSession = currentToken && requestAuthorization === `Bearer ${currentToken}`;
    if (isCurrentSession && requiresReauthentication(err.response?.status, errorCode, url)) {
      clearSession({ preservePendingAppointments: true });
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = `${base}/login`;
      }
    }
    return Promise.reject(err);
  },
);

/* ── Session Helpers ──────────────────────────────────────── */

const SESSION_KEYS = [
  'ht_token', 'ht_refresh_token', 'ht_user', 'ht_email',
  'ht_name', 'ht_role', 'ht_user_id',
] as const;

export function clearSession(options: { preservePendingAppointments?: boolean } = {}) {
  if (!options.preservePendingAppointments) clearPendingAppointments();
  SESSION_KEYS.forEach(k => localStorage.removeItem(k));
}

export function persistSession(data: {
  access_token: string;
  refresh_token?: string;
  user: { id: string | number; email: string; role: string; name?: string };
}) {
  localStorage.setItem('ht_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('ht_refresh_token', data.refresh_token);
  else localStorage.removeItem('ht_refresh_token');
  localStorage.setItem('ht_user', JSON.stringify(data.user));
  localStorage.setItem('ht_email', data.user.email);
  localStorage.setItem('ht_name', data.user.name || '');
  localStorage.setItem('ht_role', data.user.role);
  localStorage.setItem('ht_user_id', String(data.user.id));
}

export function getSession() {
  const token = localStorage.getItem('ht_token');
  if (!token) return null;
  const email = localStorage.getItem('ht_email') || '';
  const name = localStorage.getItem('ht_name') || '';
  const role = localStorage.getItem('ht_role') || 'patient';
  const userId = localStorage.getItem('ht_user_id') || '';
  return { token, email, name, role, userId };
}

export function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  }
  if (email) return email.substring(0, 2).toUpperCase();
  return 'U';
}

export default api;
