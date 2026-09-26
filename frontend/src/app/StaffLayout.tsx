import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, staffSession, useStaffUser } from '../lib/api';
import { BuildingIcon, GridIcon, PlusIcon, SparkleIcon, UsersIcon } from '../components/icons';

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name[0].toUpperCase();
}

export function StaffLayout() {
  const navigate = useNavigate();
  const me = useStaffUser();

  async function signOut() {
    // Clear the httpOnly cookie server-side; sign out locally regardless.
    await api.staffLogout().catch(() => undefined);
    staffSession.clear();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">B2B Ops</div>
        <nav className="app-sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
            <GridIcon /> Dashboard
          </NavLink>
          <NavLink to="/schools" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
            <BuildingIcon /> Schools
          </NavLink>
          <NavLink to="/agent-suggestions" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
            <SparkleIcon /> AI Suggestions
          </NavLink>
          {(me?.role === 'SALES' || me?.role === 'SUPER_ADMIN') && (
            <NavLink to="/schools/new" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              <PlusIcon /> New School
            </NavLink>
          )}
          {me?.role === 'SUPER_ADMIN' && (
            <NavLink to="/staff" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              <UsersIcon /> Staff
            </NavLink>
          )}
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-user">
            <span className="app-topbar-role">{me?.role.replace('_', ' ')}</span>
            <span className="app-topbar-name">{me?.name}</span>
            <div className="app-avatar">{initials(me?.name)}</div>
            <button className="app-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
