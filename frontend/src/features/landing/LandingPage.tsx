import { Link, Navigate } from 'react-router-dom';
import { useStaffUser } from '../../lib/api';
import { PHASE_LABELS, PHASE_ORDER } from '../../lib/phases';
import {
  AiDraftIllustration,
  ChecklistIllustration,
  DashboardIllustration,
  RenewalIllustration,
} from './LandingIllustrations';

const FEATURES = [
  {
    eyebrow: 'Guided onboarding',
    title: 'Every school follows the same SOP — step by step',
    text: 'Each new school gets its own checklist for all 10 phases, with every task tagged to the team that owns it. Phases advance in order, so nothing is skipped or forgotten.',
    points: ['Auto-generated checklist per school', 'Clear owner for every task', 'Progress visible at a glance'],
    Illustration: ChecklistIllustration,
  },
  {
    eyebrow: 'AI assistance',
    title: 'Agents spot who needs attention and draft the email',
    text: 'Daily agents flag overdue visits, stalled renewals, and missing feedback. Relationship emails are drafted for you to review; routine reminders go out on their own.',
    points: ['You approve before anything personal is sent', 'Automatic workshop reminders', 'Alerts for schools stuck in a phase'],
    Illustration: AiDraftIllustration,
  },
  {
    eyebrow: 'Renewals',
    title: 'Walk into every renewal with a year of proof',
    text: 'Workshops, visits, and competitions are logged all year, so each renewal conversation starts with a ready-made summary of what the school received.',
    points: ['Renewal pipeline by status', 'Year-in-review built automatically', 'Every email logged for audit'],
    Illustration: RenewalIllustration,
  },
];

const ROLES = [
  { name: 'Sales', text: 'Hands over a new school with its commitments in one form.' },
  { name: 'Account Managers', text: 'See only their schools, with visits and calls tracked.' },
  { name: 'Operations', text: 'Run LMS setup, infra checks, and workshop scheduling.' },
  { name: 'Training', text: 'Track teacher training and certification per school.' },
];

export function LandingPage() {
  const me = useStaffUser();
  if (me) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="app-sidebar-brand landing-brand">B2B Ops</div>
        <nav className="landing-nav-links">
          <a className="landing-anchor" href="#how">How it works</a>
          <a className="landing-anchor" href="#features">Features</a>
          <Link to="/login">
            <button type="button" className="secondary">
              Sign in
            </button>
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-text">
          <span className="landing-eyebrow">For CodeVidhya’s school partnerships team</span>
          <h1>
            Onboard every partner school <span>the same way, every time.</span>
          </h1>
          <p className="landing-hero-subtitle">
            One shared workspace that takes each school from sales handover to annual renewal — with checklists,
            workshop tracking, and AI follow-ups for Sales, Account Management, Operations, and Training.
          </p>
          <div className="landing-hero-actions">
            <Link to="/signup">
              <button type="button">Get started</button>
            </Link>
            <Link to="/login">
              <button type="button" className="secondary">
                Sign in
              </button>
            </Link>
          </div>
        </div>
        <div className="landing-hero-visual">
          <DashboardIllustration />
        </div>
      </section>

      <section id="how" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">How it works</span>
          <h2>10 phases, from first handover to renewal</h2>
          <p>Each school moves through the SOP in order. You always know where it stands and what’s next.</p>
        </div>
        <ol className="landing-journey">
          {PHASE_ORDER.map((phase, i) => (
            <li key={phase}>
              <span className="landing-journey-num">{i + 1}</span>
              <span className="landing-journey-label">{PHASE_LABELS[phase]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="landing-section">
        {FEATURES.map((f, i) => (
          <div key={f.title} className={`landing-feature-row${i % 2 ? ' reverse' : ''}`}>
            <div className="landing-feature-text">
              <span className="landing-eyebrow">{f.eyebrow}</span>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
              <ul className="landing-points">
                {f.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="landing-feature-visual">
              <f.Illustration />
            </div>
          </div>
        ))}
      </section>

      <section className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Built for the whole team</span>
          <h2>Each role sees what it needs</h2>
        </div>
        <div className="landing-roles">
          {ROLES.map((r) => (
            <div key={r.name} className="landing-feature-card">
              <h3>{r.name}</h3>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2>Ready to bring your schools into one place?</h2>
        <p>Create your staff account and start tracking in minutes.</p>
        <div className="landing-hero-actions">
          <Link to="/signup">
            <button type="button">Create an account</button>
          </Link>
          <Link to="/login">
            <button type="button" className="secondary">
              Sign in
            </button>
          </Link>
        </div>
      </section>

      <footer className="landing-footer">© {new Date().getFullYear()} CodeVidhya · B2B Ops Platform</footer>
    </div>
  );
}
