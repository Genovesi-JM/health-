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
import { defaultAccountPath } from './authRouting';

type Role = 'patient' | 'cliente' | 'doctor' | 'nurse' | 'admin' | 'support' | 'corporate_admin';

interface Props {
  /** Which roles are allowed to access the wrapped routes. */
  allowedRoles: Role[];
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
    return <Navigate to={defaultAccountPath(user)} replace />;
  }

  return <Outlet />;
}
