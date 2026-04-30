import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { I18nProvider } from './i18n/LanguageContext';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';

/* Root smart redirect: send logged-in users to their dashboard */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LandingPage />;
  if (user.role === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

/* Public pages */
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import EspecialistasPage from './pages/EspecialistasPage';
import TeleconsultaPage from './pages/TeleconsultaPage';
import UrgenciaPage from './pages/UrgenciaPage';
import EmpresasPage from './pages/EmpresasPage';
import FAQPage from './pages/FAQPage';
import ContactoPage from './pages/ContactoPage';
import PatientsPage from './pages/PatientsPage';
import ClinicsPage from './pages/ClinicsPage';
import ChronicCarePage from './pages/ChronicCarePage';
import DevicesPage from './pages/DevicesPage';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DoctorRegisterPage from './pages/DoctorRegisterPage';
import DoctorsListPage from './pages/DoctorsListPage';
import PublicDoctorPage from './pages/PublicDoctorPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import MedicalDisclaimerPage from './pages/MedicalDisclaimerPage';

/* Protected pages */
import DashboardPage from './pages/DashboardPage';
import PatientProfilePage from './pages/PatientProfilePage';
import TriagePage from './pages/TriagePage';
import ConsultationsPage from './pages/ConsultationsPage';
import ConsentsPage from './pages/ConsentsPage';
import DoctorDashboardPage from './pages/DoctorDashboardPage';
import DoctorProfileEditPage from './pages/DoctorProfileEditPage';
import DoctorQueuePage from './pages/DoctorQueuePage';
import DoctorAgendaPage from './pages/DoctorAgendaPage';
import DoctorPatientsPage from './pages/DoctorPatientsPage';
import DoctorLivePage from './pages/DoctorLivePage';
import DoctorPrescriptionsPage from './pages/DoctorPrescriptionsPage';
import PatientPrescriptionRequestPage from './pages/PatientPrescriptionRequestPage';
import DoctorMessagesPage from './pages/DoctorMessagesPage';
import DoctorFinancePage from './pages/DoctorFinancePage';
import DoctorReviewsPage from './pages/DoctorReviewsPage';
import DoctorSecurityPage from './pages/DoctorSecurityPage';
import DoctorSuportePage from './pages/DoctorSuportePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminDoctorsPage from './pages/AdminDoctorsPage';
import AdminPatientsPage from './pages/AdminPatientsPage';
import SettingsPage from './pages/SettingsPage';
import SelfCarePage from './pages/SelfCarePage';
import FamilyPage from './pages/FamilyPage';
import NotificationsPage from './pages/NotificationsPage';
import PatientReadingsPage from './pages/PatientReadingsPage';
import ConsentGatePage from './pages/ConsentGatePage';
import InstallPrompt from './components/InstallPrompt';

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

export default function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <BrowserRouter basename={BASE}>
        <Routes>
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
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/clinics" element={<ClinicsPage />} />
          <Route path="/chronic-care" element={<ChronicCarePage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/register/doctor" element={<DoctorRegisterPage />} />
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
            {/* Settings — accessible to all roles */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* ── PATIENT only ── */}
            <Route element={<RoleRoute allowedRoles={['patient', 'cliente']} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/patient/profile" element={<PatientProfilePage />} />
              <Route path="/triage" element={<TriagePage />} />
              <Route path="/consultations" element={<ConsultationsPage />} />
              <Route path="/self-care" element={<SelfCarePage />} />
              <Route path="/prescricoes/pedido" element={<PatientPrescriptionRequestPage />} />
              <Route path="/consents" element={<ConsentsPage />} />
              <Route path="/family" element={<FamilyPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/patient/readings" element={<PatientReadingsPage />} />
            </Route>

            {/* ── DOCTOR only ── */}
            <Route element={<RoleRoute allowedRoles={['doctor']} />}>
              <Route path="/doctor/dashboard" element={<DoctorDashboardPage />} />
              <Route path="/doctor/profile" element={<DoctorProfileEditPage />} />
              <Route path="/doctor/queue" element={<DoctorQueuePage />} />
              <Route path="/doctor/agenda" element={<DoctorAgendaPage />} />
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
            </Route>
          </Route>

          {/* Catch-all → login (preserves destination for redirect after login) */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  );
}
