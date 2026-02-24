import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

/* Public pages */
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

/* Protected pages */
import DashboardPage from './pages/DashboardPage';
import PatientProfilePage from './pages/PatientProfilePage';
import TriagePage from './pages/TriagePage';
import ConsultationsPage from './pages/ConsultationsPage';
import ConsentsPage from './pages/ConsentsPage';
import DoctorProfilePage from './pages/DoctorProfilePage';
import DoctorQueuePage from './pages/DoctorQueuePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminDoctorsPage from './pages/AdminDoctorsPage';
import AdminPatientsPage from './pages/AdminPatientsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/health-">
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Protected — wrapped with sidebar layout */}
          <Route element={<ProtectedRoute />}>
            {/* Patient */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/patient/profile" element={<PatientProfilePage />} />
            <Route path="/triage" element={<TriagePage />} />
            <Route path="/consultations" element={<ConsultationsPage />} />
            <Route path="/consents" element={<ConsentsPage />} />

            {/* Doctor */}
            <Route path="/doctor/profile" element={<DoctorProfilePage />} />
            <Route path="/doctor/queue" element={<DoctorQueuePage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/doctors" element={<AdminDoctorsPage />} />
            <Route path="/admin/patients" element={<AdminPatientsPage />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
