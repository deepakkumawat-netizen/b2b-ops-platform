import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { staffToken, staffUser } from '../lib/api';

export function StaffLayout() {
  const navigate = useNavigate();
  const me = staffUser.get();

  function signOut() {
    staffToken.clear();
    staffUser.clear();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">B2B Ops</div>
        <nav className="app-sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/schools" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
            Schools
          </NavLink>
          {(me?.role === 'SALES' || me?.role === 'SUPER_ADMIN') && (
            <NavLink to="/schools/new" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
              New School (Handover)
            </NavLink>
          )}
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-user">
            <span className="app-topbar-name">{me?.name}</span>
            <span className="app-topbar-role">{me?.role.replace('_', ' ')}</span>
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
