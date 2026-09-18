import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SchoolStatus } from '@b2b-ops/shared';
import { api, School, staffToken, staffUser } from '../../lib/api';
import { PhaseProgress } from '../../components/PhaseProgress';
import { EmptyState } from '../../components/EmptyState';
import { BuildingIcon } from '../../components/icons';

const STATUS_BADGE_CLASS: Record<SchoolStatus, string> = {
  ACTIVE: 'badge badge-success',
  RENEWED: 'badge',
  CHURNED: 'badge badge-danger',
};

export function SchoolsListPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const token = staffToken.get();
  const canAddSchool = staffUser.get()?.role === 'SALES' || staffUser.get()?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!token) return;
    api.listSchools(token).then(setSchools).catch((err) => setError(err.message));
  }, [token]);

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
          </tbody>
        </table>
      )}
    </div>
  );
}
