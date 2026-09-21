import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StaffRole } from '@b2b-ops/shared';
import { api, staffToken, staffUser } from '../../lib/api';

const ROLE_LABELS: Record<StaffRole, string> = {
  [StaffRole.SUPER_ADMIN]: 'Super Admin',
  [StaffRole.SALES]: 'Sales',
  [StaffRole.ACCOUNT_MANAGER]: 'Account Manager',
  [StaffRole.OPERATIONS]: 'Operations',
  [StaffRole.TRAINING]: 'Training',
};

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!role) {
      setError('Pick a designation');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken, staff } = await api.staffSignup({ name, email, password, role });
      staffToken.set(accessToken);
      staffUser.set(staff);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-form" onSubmit={onSubmit}>
        <h1>Create account</h1>
        <p className="auth-subtitle">
          For anyone on the operations team who needs access — your Super Admin gets notified once you sign up.
        </p>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus autoComplete="name" />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label>
          Designation
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} required>
            <option value="">—</option>
            {Object.values(StaffRole).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
