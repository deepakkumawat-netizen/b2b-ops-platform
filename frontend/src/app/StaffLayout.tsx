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

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="2" width="16" height="20" rx="1" />
      <line x1="9" y1="7" x2="9" y2="7.01" />
      <line x1="15" y1="7" x2="15" y2="7.01" />
      <line x1="9" y1="12" x2="9" y2="12.01" />
      <line x1="15" y1="12" x2="15" y2="12.01" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
