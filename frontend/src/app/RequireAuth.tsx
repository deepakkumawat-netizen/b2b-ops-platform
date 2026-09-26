import { Navigate, Outlet } from 'react-router-dom';
import { useStaffUser } from '../lib/api';

export function RequireAuth() {
  const me = useStaffUser();
  return me ? <Outlet /> : <Navigate to="/login" replace />;
}
