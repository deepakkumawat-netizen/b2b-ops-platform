import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { StaffRole } from '@b2b-ops/shared';
import { api, StaffMember, useStaffUser } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { UsersIcon } from '../../components/icons';
import { SkeletonTableRows } from '../../components/Skeleton';

const ROLE_LABELS: Record<StaffRole, string> = {
  [StaffRole.SUPER_ADMIN]: 'Super Admin',
  [StaffRole.SALES]: 'Sales',
  [StaffRole.ACCOUNT_MANAGER]: 'Account Manager',
  [StaffRole.OPERATIONS]: 'Operations',
  [StaffRole.TRAINING]: 'Training',
};

function RoleSelect({ value, disabled, onChange }: { value: StaffRole; disabled?: boolean; onChange: (r: StaffRole) => void }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as StaffRole)}>
      {Object.values(StaffRole).map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

// Super Admin only — approve self-signups, change roles, deactivate leavers.
export function StaffPage() {
  const me = useStaffUser();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reload() {
    return api
      .listStaff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  if (me && me.role !== StaffRole.SUPER_ADMIN) return <Navigate to="/dashboard" replace />;

  async function act(id: string, action: () => Promise<unknown>, message: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  const pending = staff.filter((s) => !s.approvedAt);
  const active = staff.filter((s) => s.approvedAt && s.isActive);
  const inactive = staff.filter((s) => s.approvedAt && !s.isActive);

  return (
    <div className="page">
      <h1>Staff</h1>
      <p className="page-intro">Approve new account requests, change roles, and deactivate people who have left.</p>
      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      <section className="staff-section">
        <h2>Awaiting approval {pending.length > 0 && <span className="badge badge-warning">{pending.length}</span>}</h2>
        {loading ? (
          <table className="data-table">
            <tbody>
              <SkeletonTableRows rows={2} columns={4} />
            </tbody>
          </table>
        ) : pending.length === 0 ? (
          <p className="muted">No account requests waiting.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Requested role</th>
                <th>Requested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>
                    <RoleSelect
                      value={s.role}
                      disabled={busyId === s.id}
                      onChange={(role) => act(s.id, () => api.updateStaff(s.id, { role }), `${s.name}'s requested role changed`)}
                    />
                  </td>
                  <td>{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div className="button-row">
                      <button
                        disabled={busyId === s.id}
                        onClick={() => act(s.id, () => api.updateStaff(s.id, { isActive: true }), `${s.name} approved — they've been emailed`)}
                      >
                        Approve
                      </button>
                      <button
                        className="danger"
                        disabled={busyId === s.id}
                        onClick={() => {
                          if (window.confirm(`Reject and delete ${s.name}'s account request?`)) {
                            act(s.id, () => api.rejectPendingStaff(s.id), `${s.name}'s request rejected`);
                          }
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="staff-section">
        <h2>Active staff</h2>
        {!loading && active.length === 0 ? (
          <EmptyState icon={<UsersIcon width={24} height={24} />} title="No active staff" text="Approved accounts show up here." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={4} columns={4} />
              ) : (
                active.map((s) => {
                  const isMe = s.id === me?.id;
                  return (
                    <tr key={s.id}>
                      <td>
                        {s.name} {isMe && <span className="badge badge-muted">You</span>}
                      </td>
                      <td>{s.email}</td>
                      <td>
                        <RoleSelect
                          value={s.role}
                          disabled={isMe || busyId === s.id}
                          onChange={(role) => act(s.id, () => api.updateStaff(s.id, { role }), `${s.name} is now ${ROLE_LABELS[role]}`)}
                        />
                      </td>
                      <td>
                        {!isMe && (
                          <button
                            className="danger"
                            disabled={busyId === s.id}
                            onClick={() => {
                              if (window.confirm(`Deactivate ${s.name}? They'll be signed out and unable to sign in.`)) {
                                act(s.id, () => api.updateStaff(s.id, { isActive: false }), `${s.name} deactivated`);
                              }
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </section>

      {inactive.length > 0 && (
        <section className="staff-section">
          <h2>Deactivated</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {inactive.map((s) => (
                <tr key={s.id}>
                  <td className="muted">{s.name}</td>
                  <td className="muted">{s.email}</td>
                  <td className="muted">{ROLE_LABELS[s.role]}</td>
                  <td>
                    <button
                      className="secondary"
                      disabled={busyId === s.id}
                      onClick={() => act(s.id, () => api.updateStaff(s.id, { isActive: true }), `${s.name} reactivated`)}
                    >
                      Reactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
