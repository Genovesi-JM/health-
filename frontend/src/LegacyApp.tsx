import { Component, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { I18nProvider } from './i18n/LanguageContext';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { defaultAccountPath } from './authRouting';

/* Root smart redirect: send logged-in users to their dashboard */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LandingPage />;
  return <Navigate to={defaultAccountPath(user)} replace />;
}

/* Public pages */
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const EspecialistasPage = lazy(() => import('./pages/EspecialistasPage'));
const TeleconsultaPage = lazy(() => import('./pages/TeleconsultaPage'));
const UrgenciaPage = lazy(() => import('./pages/UrgenciaPage'));
const EmpresasPage = lazy(() => import('./pages/EmpresasPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const ContactoPage = lazy(() => import('./pages/ContactoPage'));
const MapaPage = lazy(() => import('./pages/MapaPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const ClinicsPage = lazy(() => import('./pages/ClinicsPage'));
const ChronicCarePage = lazy(() => import('./pages/ChronicCarePage'));
const DevicesPage = lazy(() => import('./pages/DevicesPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ChooseAccountTypePage = lazy(() => import('./pages/ChooseAccountTypePage'));
const PatientOnboardingPage = lazy(() => import('./pages/PatientOnboardingPage'));
const ProfessionalOnboardingPage = lazy(() => import('./pages/ProfessionalOnboardingPage'));
const OrganisationOnboardingPage = lazy(() => import('./pages/OrganisationOnboardingPage'));
const CaregiverOnboardingPage = lazy(() => import('./pages/CaregiverOnboardingPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const DoctorRegisterPage = lazy(() => import('./pages/DoctorRegisterPage'));
const DoctorApplyPage = lazy(() => import('./pages/DoctorApplyPage'));
const DoctorsListPage = lazy(() => import('./pages/DoctorsListPage'));
const PublicDoctorPage = lazy(() => import('./pages/PublicDoctorPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const MedicalDisclaimerPage = lazy(() => import('./pages/MedicalDisclaimerPage'));

/* Protected pages */
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PatientProfilePage = lazy(() => import('./pages/PatientProfilePage'));
const PatientDocumentsPage = lazy(() => import('./pages/PatientDocumentsPage'));
const TriagePage = lazy(() => import('./pages/TriagePage'));
const ConsultationsPage = lazy(() => import('./pages/ConsultationsPage'));
const ConsentsPage = lazy(() => import('./pages/ConsentsPage'));
const DoctorDashboardPage = lazy(() => import('./pages/DoctorDashboardPage'));
const DoctorProfileEditPage = lazy(() => import('./pages/DoctorProfileEditPage'));
const DoctorQueuePage = lazy(() => import('./pages/DoctorQueuePage'));
const DoctorAgendaPage = lazy(() => import('./pages/DoctorAgendaPage'));
const DoctorAvailabilityPage = lazy(() => import('./pages/DoctorAvailabilityPage'));
const DoctorPatientsPage = lazy(() => import('./pages/DoctorPatientsPage'));
const DoctorLivePage = lazy(() => import('./pages/DoctorLivePage'));
const DoctorPrescriptionsPage = lazy(() => import('./pages/DoctorPrescriptionsPage'));
const PatientPrescriptionRequestPage = lazy(() => import('./pages/PatientPrescriptionRequestPage'));
const DoctorMessagesPage = lazy(() => import('./pages/DoctorMessagesPage'));
const DoctorFinancePage = lazy(() => import('./pages/DoctorFinancePage'));
const DoctorReviewsPage = lazy(() => import('./pages/DoctorReviewsPage'));
const DoctorSecurityPage = lazy(() => import('./pages/DoctorSecurityPage'));
const DoctorSuportePage = lazy(() => import('./pages/DoctorSuportePage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminDoctorsPage = lazy(() => import('./pages/AdminDoctorsPage'));
const AdminPatientsPage = lazy(() => import('./pages/AdminPatientsPage'));
const AdminApplicationsPage = lazy(() => import('./pages/AdminApplicationsPage'));
const AdminCredentialsPage = lazy(() => import('./pages/AdminCredentialsPage'));
const AdminCompliancePage = lazy(() => import('./pages/AdminCompliancePage'));
const AdminExpiryPage = lazy(() => import('./pages/AdminExpiryPage'));
const CorporateDashboardPage = lazy(() => import('./pages/CorporateDashboardPage'));
const NurseDashboardPage = lazy(() => import('./pages/NurseDashboardPage'));
const StorePage = lazy(() => import('./pages/StorePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SecurityMfaPage = lazy(() => import('./pages/SecurityMfaPage'));
const SecuritySettingsPage = lazy(() => import('./pages/SecuritySettingsPage'));
const SelfCarePage = lazy(() => import('./pages/SelfCarePage'));
const FamilyPage = lazy(() => import('./pages/FamilyPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const PatientReadingsPage = lazy(() => import('./pages/PatientReadingsPage'));
const ConsentGatePage = lazy(() => import('./pages/ConsentGatePage'));
const ProfessionalVerificationPage = lazy(() => import('./pages/ProfessionalVerificationPage'));
const NurseDashboardPreviewShell = lazy(() => import('./pages/NurseDashboardPreviewShell'));
const ClinicianPatientWorkspacePage = lazy(() => import('./pages/ClinicianPatientWorkspacePage'));
import InstallPrompt from './components/InstallPrompt';

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

class RouteLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="page-loading" role="alert" style={{ flexDirection: 'column', gap: '1rem', padding: '1.5rem', textAlign: 'center' }}>
      <p>Não foi possível abrir esta página. Verifique a ligação e tente recarregar.</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Recarregar página</button>
      <a href={BASE}>Voltar ao início</a>
    </div>;
    return this.props.children;
  }
}

function RouteContent({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <RouteLoadBoundary key={location.pathname}>
    <Suspense fallback={<div className="page-loading" role="status" aria-live="polite" style={{ gap: '1rem' }}><div className="spinner" aria-hidden="true" /><span>A carregar página…</span></div>}>
      {children}
    </Suspense>
  </RouteLoadBoundary>;
}

export default function App() {
  if (import.meta.env.DEV && window.location.pathname.includes('/preview/')) {
    return (
      <I18nProvider>
        <BrowserRouter basename={BASE}>
          <RouteContent><Routes>
            <Route path="/preview/nurse" element={<NurseDashboardPreviewShell />} />
            <Route path="/preview/clinician/patient" element={<ClinicianPatientWorkspacePage preview />} />
            <Route path="*" element={<Navigate to="/preview/nurse" replace />} />
          </Routes></RouteContent>
        </BrowserRouter>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
    <AuthProvider>
      <BrowserRouter basename={BASE}>
        <RouteContent><Routes>
          {/* Public */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/especialistas" element={<EspecialistasPage />} />
          <Route path="/telemedicina" element={<TeleconsultaPage />} />
          <Route path="/urgencia" element={<UrgenciaPage />} />
          <Route path="/empresas" element={<EmpresasPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contacto" element={<ContactoPage />} />
          <Route path="/mapa" element={<MapaPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/clinics" element={<ClinicsPage />} />
          <Route path="/chronic-care" element={<ChronicCarePage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/choose-account-type" element={<ChooseAccountTypePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/register/doctor" element={<DoctorRegisterPage />} />
          <Route path="/candidatura" element={<DoctorApplyPage />} />
          <Route path="/medicos" element={<DoctorsListPage />} />
          <Route path="/medicos/:slug" element={<PublicDoctorPage />} />
          {/* Legal / public */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/medical-disclaimer" element={<MedicalDisclaimerPage />} />
          {/* Protected — wrapped with sidebar layout */}
          <Route element={<ProtectedRoute />}>
            {/* Consent gate — accessible to any authenticated user */}
            <Route path="/consent-gate" element={<ConsentGatePage />} />
            <Route path="/data-consent" element={<ConsentGatePage />} />
            <Route path="/onboarding/patient" element={<PatientOnboardingPage />} />
            <Route path="/onboarding/professional" element={<ProfessionalOnboardingPage />} />
            <Route path="/onboarding/organisation" element={<OrganisationOnboardingPage />} />
            <Route path="/onboarding/caregiver" element={<CaregiverOnboardingPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            {/* Settings — accessible to all roles */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/security/mfa" element={<SecurityMfaPage />} />
            <Route path="/security" element={<SecuritySettingsPage />} />
            <Route path="/professional-verification" element={<ProfessionalVerificationPage />} />
            <Route element={<RoleRoute allowedRoles={['doctor', 'nurse']} />}>
              <Route path="/clinician/patients/:patientId" element={<ClinicianPatientWorkspacePage />} />
            </Route>

            {/* ── PATIENT only ── */}
            <Route element={<RoleRoute allowedRoles={['patient', 'cliente']} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/patient/profile" element={<PatientProfilePage />} />
              <Route path="/patient/documents" element={<PatientDocumentsPage />} />
              <Route path="/triage" element={<TriagePage />} />
              <Route path="/consultations" element={<ConsultationsPage />} />
              <Route path="/self-care" element={<SelfCarePage />} />
              <Route path="/prescricoes/pedido" element={<PatientPrescriptionRequestPage />} />
              <Route path="/consents" element={<ConsentsPage />} />
              <Route path="/family" element={<FamilyPage />} />
              <Route path="/patient/readings" element={<PatientReadingsPage />} />
              <Route path="/loja" element={<StorePage />} />
            </Route>

            {/* ── EMPLOYER / CORPORATE (self-serve: any logged-in user can create one) ── */}
            <Route element={<RoleRoute allowedRoles={['patient', 'cliente', 'corporate_admin']} />}>
              <Route path="/corporate" element={<CorporateDashboardPage />} />
            </Route>

            {/* ── NURSE only ── */}
            <Route element={<RoleRoute allowedRoles={['nurse']} />}>
              <Route path="/nurse" element={<NurseDashboardPage />} />
            </Route>

            {/* ── DOCTOR only ── */}
            <Route element={<RoleRoute allowedRoles={['doctor']} />}>
              <Route path="/doctor/dashboard" element={<DoctorDashboardPage />} />
              <Route path="/doctor/profile" element={<DoctorProfileEditPage />} />
              <Route path="/doctor/queue" element={<DoctorQueuePage />} />
              <Route path="/doctor/agenda" element={<DoctorAgendaPage />} />
              <Route path="/doctor/disponibilidade" element={<DoctorAvailabilityPage />} />
              <Route path="/doctor/pacientes" element={<DoctorPatientsPage />} />
              <Route path="/doctor/consultas" element={<DoctorLivePage />} />
              <Route path="/doctor/prescricoes" element={<DoctorPrescriptionsPage />} />
              <Route path="/doctor/mensagens" element={<DoctorMessagesPage />} />
              <Route path="/doctor/financeiro" element={<DoctorFinancePage />} />
              <Route path="/doctor/avaliacoes" element={<DoctorReviewsPage />} />
              <Route path="/doctor/security" element={<DoctorSecurityPage />} />
              <Route path="/doctor/suporte" element={<DoctorSuportePage />} />
            </Route>

            {/* ── ADMIN only ── */}
            <Route element={<RoleRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/doctors" element={<AdminDoctorsPage />} />
              <Route path="/admin/patients" element={<AdminPatientsPage />} />
              <Route path="/admin/applications" element={<AdminApplicationsPage />} />
              <Route path="/admin/credentials" element={<AdminCredentialsPage />} />
              <Route path="/admin/compliance" element={<AdminCompliancePage />} />
              <Route path="/admin/expiry" element={<AdminExpiryPage />} />
            </Route>
          </Route>

          {/* Catch-all → login (preserves destination for redirect after login) */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes></RouteContent>
        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  );
}
