// Shared types matching backend health_schemas.py

export type Role = 'patient' | 'doctor' | 'corporate_admin' | 'admin' | 'support' | 'cliente';

export interface User {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  name?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: User;
}

export interface Patient {
  id: string;
  user_id: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  license_number: string;
  specialization: string;
  bio?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  user?: { email: string };
}

export interface TriageQuestion {
  key: string;
  label: string;
  type: 'boolean' | 'scale' | 'select';
  options?: string[];
}

export interface TriageStartResponse {
  session_id: string;
  questions: TriageQuestion[];
}

export interface TriageResult {
  id: string;
  triage_session_id: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  recommended_action: 'SELF_CARE' | 'DOCTOR_24H' | 'DOCTOR_NOW' | 'ER_NOW';
  score: number;
  reasoning: Record<string, unknown>;
  created_at: string;
}

export interface TriageHistoryItem {
  session_id: string;
  chief_complaint: string;
  status: string;
  risk_level?: string;
  recommended_action?: string;
  score?: number;
  created_at: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  doctor_id?: string;
  triage_session_id?: string;
  specialty: string;
  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  cancellation_reason?: string;
  payment_status: string;
  created_at: string;
}

export interface ConsultationQueueItem {
  id: string;
  patient_name: string;
  specialty: string;
  risk_level?: string;
  status: string;
  created_at: string;
}

export interface Consent {
  id: string;
  patient_id: string;
  consent_type: string;
  accepted_at: string;
}

export interface DashboardKPIs {
  total_triage_sessions: number;
  total_consultations: number;
  total_patients: number;
  total_doctors: number;
  consultations_today: number;
  avg_triage_score: number;
}

export interface PatientState {
  current_state: 'no_triage' | 'triage_in_progress' | 'triage_completed' | 'consultation_booked' | 'consultation_completed';
  state_label: string;
  last_triage_risk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  last_triage_action?: 'SELF_CARE' | 'DOCTOR_24H' | 'DOCTOR_NOW' | 'ER_NOW';
  last_triage_complaint?: string;
  last_triage_score?: number;
  last_triage_date?: string;
  last_triage_session_id?: string;
  next_action: string;
  next_action_label: string;
  next_action_urgency: 'low' | 'medium' | 'high' | 'critical';
  next_action_deadline?: string;
  triage_count: number;
  consultation_count: number;
  completed_consultations: number;
  pending_consultations: number;
  resolution_rate?: number;
}

export interface AdminDashboard {
  total_patients: number;
  total_doctors: number;
  pending_doctors: number;
  total_consultations: number;
  total_triage_sessions: number;
  revenue_total: number;
  // Business metrics
  pending_verifications: number;
  flagged_triage_sessions: number;
  consultations_this_month: number;
  resolution_rate: number;
  risk_distribution: Record<string, number>;
  active_patients: number;
  revenue_this_month?: number;
}
