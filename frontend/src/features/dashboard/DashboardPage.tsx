import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SchoolLifecyclePhase } from '@b2b-ops/shared';
import { api, Dashboard, staffToken } from '../../lib/api';

// Plain string keys (not computed from the enum) — same values, but this
// keeps SchoolLifecyclePhase a type-only import that's fully erased at
// build time, matching how every other page in this app only ever uses
// these shared enums as runtime values via direct member access (e.g.
// WorkshopStatus.SCHEDULED), never as computed object keys.
const PHASE_LABELS: Record<SchoolLifecyclePhase, string> = {
  SALES_HANDOVER: 'Sales Handover',
  WELCOME: 'Welcome',
  ORIENTATION: 'Orientation',
  ONBOARDING_SETUP: 'Onboarding Setup',
  DATA_COLLECTION_LMS: 'Data Collection & LMS',
  INFRA_DIAGNOSTIC: 'Infra Diagnostic',
  TEACHER_TRAINING: 'Teacher Training',
  ONGOING_ENGAGEMENT: 'Ongoing Engagement',
  COMPETITIONS: 'Competitions',
  ANNUAL_RENEWAL: 'Annual Renewal',
};

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = staffToken.get();

  useEffect(() => {
    if (!token) return;
    api.getDashboard(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading…</p>;

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{data.totalSchools}</span>
          <span className="stat-label">Schools</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.overdueVisits.length}</span>
          <span className="stat-label">Overdue Visits</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.overdueCalls.length}</span>
          <span className="stat-label">Overdue Calls</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.pendingRenewals.length}</span>
          <span className="stat-label">Pending Renewals</span>
        </div>
        <Link to="/agent-suggestions" className="stat-tile stat-tile-link">
          <span className="stat-value">{data.pendingAgentSuggestions}</span>
          <span className="stat-label">AI Suggestions</span>
        </Link>
      </div>

      <section className="card">
        <h2>Schools by Phase</h2>
        <ul className="phase-breakdown">
          {Object.entries(PHASE_LABELS).map(([phase, label]) => (
            <li key={phase}>
              <span>{label}</span>
              <strong>{data.schoolsByPhase[phase] ?? 0}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className="card-grid">
        <section className="card">
          <h2>Overdue Visits (35+ days)</h2>
          {data.overdueVisits.length === 0 && <p className="muted">None — everyone's up to date.</p>}
          <ul>
            {data.overdueVisits.map((v) => (
              <li key={v.schoolId}>
                <Link to={`/schools/${v.schoolId}`}>{v.name}</Link>
                {v.lastVisitDate ? ` — last visit ${new Date(v.lastVisitDate).toLocaleDateString()}` : ' — never visited'}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Overdue Calls (10+ days)</h2>
          {data.overdueCalls.length === 0 && <p className="muted">None — everyone's up to date.</p>}
          <ul>
            {data.overdueCalls.map((c) => (
              <li key={c.schoolId}>
                <Link to={`/schools/${c.schoolId}`}>{c.name}</Link>
                {c.lastCallDate ? ` — last call ${new Date(c.lastCallDate).toLocaleDateString()}` : ' — never called'}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Upcoming Workshops (7 days)</h2>
          {data.upcomingWorkshops.length === 0 && <p className="muted">Nothing scheduled.</p>}
          <ul>
            {data.upcomingWorkshops.map((w) => (
              <li key={w.id}>
                {w.school.name} — {w.topic} ({new Date(w.scheduledAt).toLocaleString()})
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Pending Renewals</h2>
          {data.pendingRenewals.length === 0 && <p className="muted">None pending.</p>}
          <ul>
            {data.pendingRenewals.map((r) => (
              <li key={r.id}>
                <Link to={`/schools/${r.schoolId}`}>{r.school.name}</Link> —{' '}
                {r.cycleLabel} ({r.renewalStatus})
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
