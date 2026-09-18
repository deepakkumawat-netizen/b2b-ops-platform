import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Dashboard, staffToken } from '../../lib/api';
import { PHASE_LABELS, PHASE_ORDER } from '../../lib/phases';

type AttentionItem = {
  schoolId: string;
  name: string;
  visitOverdue: boolean;
  lastVisitDate: string | null;
  callOverdue: boolean;
  lastCallDate: string | null;
};

function mergeAttentionItems(data: Dashboard): AttentionItem[] {
  const bySchool = new Map<string, AttentionItem>();
  for (const v of data.overdueVisits) {
    bySchool.set(v.schoolId, { schoolId: v.schoolId, name: v.name, visitOverdue: true, lastVisitDate: v.lastVisitDate, callOverdue: false, lastCallDate: null });
  }
  for (const c of data.overdueCalls) {
    const existing = bySchool.get(c.schoolId);
    if (existing) {
      existing.callOverdue = true;
      existing.lastCallDate = c.lastCallDate;
    } else {
      bySchool.set(c.schoolId, { schoolId: c.schoolId, name: c.name, visitOverdue: false, lastVisitDate: null, callOverdue: true, lastCallDate: c.lastCallDate });
    }
  }
  return Array.from(bySchool.values());
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = staffToken.get();

  useEffect(() => {
    if (!token) return;
    api.getDashboard(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const attention = mergeAttentionItems(data);
  const maxPhaseCount = Math.max(1, ...Object.values(data.schoolsByPhase));

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{data.totalSchools}</span>
          <span className="stat-label">Schools</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{attention.length}</span>
          <span className="stat-label">Need Follow-up</span>
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

      <div className="section-title">Needs Attention</div>
      <section className={`card attention-card${attention.length === 0 ? ' is-empty' : ''}`}>
        {attention.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing overdue — every school is on its engagement cadence.</p>}
        {attention.map((item) => (
          <div key={item.schoolId} className="attention-row">
            <div>
              <Link to={`/schools/${item.schoolId}`}>{item.name}</Link>
              <div className="attention-row-meta">
                {item.visitOverdue && (item.lastVisitDate ? `Last visit ${new Date(item.lastVisitDate).toLocaleDateString()}` : 'Never visited')}
                {item.visitOverdue && item.callOverdue && ' · '}
                {item.callOverdue && (item.lastCallDate ? `Last call ${new Date(item.lastCallDate).toLocaleDateString()}` : 'Never called')}
              </div>
            </div>
            <div>
              {item.visitOverdue && <span className="badge badge-warning">Visit overdue</span>}{' '}
              {item.callOverdue && <span className="badge badge-warning">Call overdue</span>}
            </div>
          </div>
        ))}
      </section>

      <div className="section-title">Schools by Phase</div>
      <section className="card">
        <ul className="phase-breakdown">
          {PHASE_ORDER.map((phase) => {
            const count = data.schoolsByPhase[phase] ?? 0;
            return (
              <li key={phase}>
                <span>{PHASE_LABELS[phase]}</span>
                <div className="phase-breakdown-bar">
                  <div className="phase-breakdown-bar-fill" style={{ width: `${(count / maxPhaseCount) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="card-grid">
        <section className="card">
          <h2>Upcoming Workshops (7 days)</h2>
          {data.upcomingWorkshops.length === 0 && <p className="muted">Nothing scheduled.</p>}
          <ul>
            {data.upcomingWorkshops.map((w) => (
              <li key={w.id}>
                <Link to={`/schools/${w.schoolId}`}>{w.school.name}</Link> — {w.topic} ({new Date(w.scheduledAt).toLocaleString()})
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
                <Link to={`/schools/${r.schoolId}`}>{r.school.name}</Link> — {r.cycleLabel}{' '}
                <span className="badge badge-muted">{r.renewalStatus}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
