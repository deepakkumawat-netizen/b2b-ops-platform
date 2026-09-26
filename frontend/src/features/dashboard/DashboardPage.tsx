import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Dashboard, School, staffSession } from '../../lib/api';
import { AlertIcon, BuildingIcon, CalendarIcon, RefreshIcon, SparkleIcon } from '../../components/icons';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton, SkeletonCard } from '../../components/Skeleton';
import { PhaseDistributionChart } from '../../components/PhaseDistributionChart';
import { StatusDistributionChart } from '../../components/StatusDistributionChart';

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
  const [schools, setSchools] = useState<School[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDashboard().then(setData).catch((err) => setError(err.message));
    api.listSchools().then(setSchools).catch(() => setSchools([]));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) {
    return (
      <div className="page">
        <Skeleton height={24} width="40%" style={{ marginBottom: 10 }} />
        <Skeleton height={14} width="60%" style={{ marginBottom: 24 }} />
        <div className="stat-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-tile">
              <Skeleton width={42} height={42} style={{ borderRadius: 11 }} />
              <div style={{ flex: 1 }}>
                <Skeleton height={20} width="40%" style={{ marginBottom: 8 }} />
                <Skeleton height={12} width="70%" />
              </div>
            </div>
          ))}
        </div>
        <SkeletonCard lines={4} />
      </div>
    );
  }

  const attention = mergeAttentionItems(data);
  const statusCounts = (schools ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const firstName = staffSession.get()?.name?.split(' ')[0];

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

      <div className="card-grid">
        <section className="card">
          <h2>Schools by Phase</h2>
          <PhaseDistributionChart counts={data.schoolsByPhase} />
        </section>

        {schools && schools.length > 0 && (
          <section className="card">
            <h2>Schools by Status</h2>
            <StatusDistributionChart counts={statusCounts} />
          </section>
        )}
      </div>

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
