import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SchoolStatus } from '@b2b-ops/shared';
import { api, School, staffToken } from '../../lib/api';
import { PhaseProgress } from '../../components/PhaseProgress';

const STATUS_BADGE_CLASS: Record<SchoolStatus, string> = {
  ACTIVE: 'badge badge-success',
  RENEWED: 'badge',
  CHURNED: 'badge badge-danger',
};

export function SchoolsListPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const token = staffToken.get();

  useEffect(() => {
    if (!token) return;
    api.listSchools(token).then(setSchools).catch((err) => setError(err.message));
  }, [token]);

  return (
    <div className="page">
      <h1>Schools</h1>
      {error && <p className="error">{error}</p>}
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
          {schools.map((s) => (
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
          {schools.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No schools yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
