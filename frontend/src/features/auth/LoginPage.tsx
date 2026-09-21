import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, staffToken, staffUser } from '../../lib/api';

// Dev-only convenience while the tool is under construction — pre-fills the
// seeded Super Admin login so whoever's testing locally doesn't retype it.
// import.meta.env.DEV is false in the production build, so this literal
// value never ships in the bundle Render serves publicly.
const DEV_ADMIN_LOGIN = import.meta.env.DEV ? { email: 'admin@b2bops.dev', password: 'changeme123' } : null;

export function LoginPage() {
  const [email, setEmail] = useState(DEV_ADMIN_LOGIN?.email ?? '');
  const [password, setPassword] = useState(DEV_ADMIN_LOGIN?.password ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken, staff } = await api.staffLogin(email, password);
      staffToken.set(accessToken);
      staffUser.set(staff);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-form" onSubmit={onSubmit}>
        <h1>B2B Ops Platform</h1>
        <p className="auth-subtitle">School onboarding &amp; lifecycle tracker</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-switch">
          Need access? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
