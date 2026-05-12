import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, Lock, Mail } from 'lucide-react';
import { API_BASE_URL, storeAuthTokensFromResponse } from '../config/api';

function extractErrorMessage(payload: unknown, fallback = 'Login failed'): string {
  if (typeof payload === 'string') {
    return payload || fallback;
  }
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }
  const obj = payload as Record<string, unknown>;
  for (const key of ['error', 'detail', 'message', 'msg', 'error_description']) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (value && typeof value === 'object') {
      const nested = extractErrorMessage(value, '');
      if (nested) {
        return nested;
      }
    }
  }
  return fallback;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = new URLSearchParams(location.search).get('next');
  const from = next ?? (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: identifier.trim(),
          password,
        }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage = extractErrorMessage(json, response.status === 401 ? 'Invalid email or password' : 'Login failed');
        setSubmitting(false);
        setError(errorMessage);
        return;
      }

      if (!storeAuthTokensFromResponse(json)) {
        setSubmitting(false);
        setError('Login succeeded, but no access token was returned.');
        return;
      }

      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-mark" aria-hidden="true">
          <Activity size={28} strokeWidth={2.5} />
        </div>
        <h1>BobTheBuilder</h1>
        <p>Sign in with your NerveSparks account.</p>

        {error ? (
          <div className="login-error" role="alert">
            <AlertCircle size={16} />
            <span>{typeof error === 'string' ? error : 'Login failed'}</span>
          </div>
        ) : null}

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="login-field">
            <span>Email / User ID</span>
            <div className="login-input-wrap">
              <Mail size={17} />
              <input
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                type="text"
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-input-wrap">
              <Lock size={17} />
              <input
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
              />
            </div>
          </label>

          <button className="login-submit" disabled={submitting} type="submit">
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}
