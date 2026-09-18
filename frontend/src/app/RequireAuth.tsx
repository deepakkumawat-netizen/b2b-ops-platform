import { Navigate, Outlet } from 'react-router-dom';
import { useStaffToken } from '../lib/api';

export function RequireAuth() {
  const token = useStaffToken();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
