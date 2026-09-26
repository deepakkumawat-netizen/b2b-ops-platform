import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { StaffRole } from '@b2b-ops/shared';
import { api } from '../../lib/api';

// SUPER_ADMIN is deliberately absent — the backend rejects it too; a Super
// Admin grants it from the Staff page.
const SELF_SIGNUP_ROLES: { value: StaffRole; label: string }[] = [
  { value: StaffRole.SALES, label: 'Sales' },
  { value: StaffRole.ACCOUNT_MANAGER, label: 'Account Manager' },
  { value: StaffRole.OPERATIONS, label: 'Operations' },
  { value: StaffRole.TRAINING, label: 'Training' },
];

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!role) {
      setError('Pick a designation');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.staffSignup({ name, email, password, role });
      setRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setSubmitting(false);
    }
  }

  if (requested) {
    return (
      <div className="auth-shell">
        <div className="auth-form">
          <h1>Request received</h1>
          <p className="auth-subtitle">
            A Super Admin has been notified. You'll get an email at <strong>{email}</strong> once your account is approved,
            and then you can sign in.
          </p>
          <Link to="/login">
            <button type="button">Back to sign in</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-form" onSubmit={onSubmit}>
        <h1>Request an account</h1>
        <p className="auth-subtitle">
          For the operations team — use your work email. A Super Admin approves new accounts before they can sign in.
        </p>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus autoComplete="name" />
        </label>
        <label>
          Work email
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
            {SELF_SIGNUP_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending request…' : 'Request account'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
