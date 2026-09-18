import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Dashboard, staffToken, staffUser } from '../../lib/api';
import { PHASE_LABELS, PHASE_ORDER } from '../../lib/phases';
import { AlertIcon, BuildingIcon, CalendarIcon, RefreshIcon, SparkleIcon } from '../../components/icons';
import { EmptyState } from '../../components/EmptyState';

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
  const firstName = staffUser.get()?.name?.split(' ')[0];

  return (
    <div className="page">
      <h1>{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h1>
      <p className="page-intro">Here's what's happening across your schools today.</p>
      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-icon">
            <BuildingIcon width={20} height={20} />
          </div>
          <div>
            <span className="stat-value">{data.totalSchools}</span>
            <span className="stat-label">Schools</span>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon stat-icon-warning">
            <AlertIcon width={20} height={20} />
          </div>
          <div>
            <span className="stat-value">{attention.length}</span>
            <span className="stat-label">Need Follow-up</span>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon">
            <RefreshIcon width={20} height={20} />
          </div>
          <div>
            <span className="stat-value">{data.pendingRenewals.length}</span>
            <span className="stat-label">Pending Renewals</span>
          </div>
        </div>
        <Link to="/agent-suggestions" className="stat-tile stat-tile-link">
          <div className="stat-icon">
            <SparkleIcon width={20} height={20} />
          </div>
          <div>
            <span className="stat-value">{data.pendingAgentSuggestions}</span>
            <span className="stat-label">AI Suggestions</span>
          </div>
        </Link>
      </div>

      <div className="section-title">
        <AlertIcon width={16} height={16} /> Needs Attention
      </div>
      {attention.length === 0 ? (
        <EmptyState
          icon={<AlertIcon width={24} height={24} />}
          title="All caught up"
          text="Every school is on its monthly-visit and weekly-call cadence — nothing overdue right now."
        />
      ) : (
        <section className="card attention-card">
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
      )}

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
          <h2>
            <CalendarIcon width={15} height={15} /> Upcoming Workshops (7 days)
          </h2>
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
          <h2>
            <RefreshIcon width={15} height={15} /> Pending Renewals
          </h2>
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
