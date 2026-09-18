import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, staffToken, staffUser } from '../../lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <form className="auth-form" onSubmit={onSubmit} autoComplete="off">
        <h1>B2B Ops Platform</h1>
        <p className="auth-subtitle">School onboarding &amp; lifecycle tracker</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="off" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
