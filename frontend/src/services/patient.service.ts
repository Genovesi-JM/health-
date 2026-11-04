/**
 * Patient domain service — an example of the typed pattern. Add new patient
 * endpoints here as typed functions rather than inline `api.get` calls.
 */
import { http, endpoints, type ApiResult } from './client';

export interface PatientProfile {
  id: string;
  name?: string;
  email?: string;
  role: string;
}

export interface PatientState {
  triage_status?: string;
  next_appointment_at?: string | null;
  unread_alerts?: number;
}

export const patientService = {
  me: (): Promise<ApiResult<PatientProfile>> => http.get<PatientProfile>(endpoints.patients.me),
  state: (): Promise<ApiResult<PatientState>> => http.get<PatientState>(endpoints.dashboard.patientState),
};
