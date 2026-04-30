/**
 * RoleRoute — wraps child routes and enforces role-based access control.
 *
 * Usage:
 *   <Route element={<RoleRoute allowedRoles={['doctor']} />}>
 *     <Route path="/doctor/dashboard" element={<DoctorDashboardPage />} />
 *     ...
 *   </Route>
 *
 * Redirect rules:
 *   - Unauthenticated users are sent to /login.
 *   - Patients/clients trying to access /doctor/* are sent to /dashboard.
 *   - Doctors trying to access patient or /admin/* routes are sent to /doctor/dashboard.
 *   - Admins trying to access /doctor/* or patient routes are sent to /admin.
 */
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

type Role = 'patient' | 'cliente' | 'doctor' | 'admin' | 'support';

interface Props {
  /** Which roles are allowed to access the wrapped routes. */
  allowedRoles: Role[];
}

function fallbackPath(role: string | undefined): string {
  if (role === 'doctor') return '/doctor/dashboard';
  if (role === 'admin') return '/admin';
  return '/dashboard';
}

export function RoleRoute({ allowedRoles }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role as Role;

  if (!allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath(role)} replace />;
  }

  return <Outlet />;
}
