import { Link, Navigate } from 'react-router-dom';
import { useStaffToken } from '../../lib/api';
import { BuildingIcon, CalendarIcon, RefreshIcon, SparkleIcon } from '../../components/icons';

const FEATURES = [
  {
    icon: BuildingIcon,
    title: 'Guided onboarding',
    text: 'Every school follows the same SOP checklist, from sales handover through infra diagnostic and teacher training.',
  },
  {
    icon: CalendarIcon,
    title: 'Engagement & workshops',
    text: 'Track monthly visits, weekly calls, and student workshops in one place — nothing falls through the cracks.',
  },
  {
    icon: SparkleIcon,
    title: 'AI-drafted follow-ups',
    text: 'Agents surface schools that need a nudge and draft the email — you just review and send.',
  },
  {
    icon: RefreshIcon,
    title: 'Renewal pipeline',
    text: 'See every renewal cycle at a glance, backed by a full year of documented activity.',
  },
];

export function LandingPage() {
  const token = useStaffToken();
  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="app-sidebar-brand landing-brand">B2B Ops</div>
        <Link to="/login">
          <button type="button" className="secondary">
            Sign in
          </button>
        </Link>
      </header>

      <section className="landing-hero">
        <h1>Run school onboarding like an SOP, not a spreadsheet.</h1>
        <p className="landing-hero-subtitle">
          B2B Ops Platform tracks every partner school from sales handover to annual renewal — one shared checklist
          for Sales, Account Management, Operations, and Training.
        </p>
        <div className="landing-hero-actions">
          <Link to="/login">
            <button type="button">Sign in</button>
          </Link>
          <Link to="/signup">
            <button type="button" className="secondary">
              Create an account
            </button>
          </Link>
        </div>
      </section>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="landing-feature-card">
            <div className="stat-icon">
              <f.icon width={20} height={20} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
