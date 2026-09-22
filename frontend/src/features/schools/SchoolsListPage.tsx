import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SchoolLifecyclePhase, SchoolStatus } from '@b2b-ops/shared';
import { api, School, staffToken, staffUser } from '../../lib/api';
import { PhaseProgress } from '../../components/PhaseProgress';
import { EmptyState } from '../../components/EmptyState';
import { BuildingIcon } from '../../components/icons';
import { PHASE_LABELS, PHASE_ORDER } from '../../lib/phases';

const STATUS_BADGE_CLASS: Record<SchoolStatus, string> = {
  ACTIVE: 'badge badge-success',
  RENEWED: 'badge',
  CHURNED: 'badge badge-danger',
};

export function SchoolsListPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<SchoolLifecyclePhase | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<SchoolStatus | 'ALL'>('ALL');
  const token = staffToken.get();
  const canAddSchool = staffUser.get()?.role === 'SALES' || staffUser.get()?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!token) return;
    api.listSchools(token).then(setSchools).catch((err) => setError(err.message));
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter((s) => {
      if (phaseFilter !== 'ALL' && s.currentPhase !== phaseFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !(s.city ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [schools, search, phaseFilter, statusFilter]);

  const filtersActive = search.trim() !== '' || phaseFilter !== 'ALL' || statusFilter !== 'ALL';

  return (
    <div className="page">
      <h1>Schools</h1>
      <p className="page-intro">Every partner school and where it stands in the onboarding lifecycle.</p>
      {error && <p className="error">{error}</p>}

      {schools.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon width={24} height={24} />}
          title="No schools yet"
          text={canAddSchool ? 'Add the first school once Sales closes a deal.' : "Once Sales adds a school, it'll show up here."}
          action={
            canAddSchool ? (
              <Link to="/schools/new">
                <button type="button">Add your first school</button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="form-row">
            <input
              placeholder="Search by name or city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value as SchoolLifecyclePhase | 'ALL')}>
              <option value="ALL">All phases</option>
              {PHASE_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p]}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SchoolStatus | 'ALL')}>
              <option value="ALL">All statuses</option>
              {Object.values(SchoolStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {filtersActive && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setSearch('');
                  setPhaseFilter('ALL');
                  setStatusFilter('ALL');
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<BuildingIcon width={24} height={24} />}
              title="No schools match these filters"
              text="Try a different search term or clear the filters above."
            />
          ) : (
            <>
              <p className="muted small">
                {filtered.length} of {schools.length} school{schools.length === 1 ? '' : 's'}
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>City</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Account Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link to={`/schools/${s.id}`}>{s.name}</Link>
                      </td>
                      <td>{s.city ?? '—'}</td>
                      <td>
                        <PhaseProgress phase={s.currentPhase} compact />
                      </td>
                      <td>
                        <span className={STATUS_BADGE_CLASS[s.status]}>{s.status}</span>
                      </td>
                      <td>{s.assignedAccountManager?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
