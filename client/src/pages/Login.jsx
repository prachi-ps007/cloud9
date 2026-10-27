import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Cloud } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { deviceLabel } from '../util.js';
import { Button, ErrorBox, inputClass, Spinner } from '../components/Modal.jsx';

export default function Login() {
  const { user, login, register } = useAuth();
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/auth/status')
      .then((s) => {
        setStatus(s);
        if (!s.hasUsers) setMode('register');
      })
      .catch((e) => setError(e.message));
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await register(username, password, deviceLabel());
      else await login(username, password, deviceLabel());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <Cloud size={40} className="mx-auto text-indigo-600" />
          <h1 className="mt-2 text-2xl font-bold">Cloud9</h1>
          <p className="text-sm text-slate-500">Your private cloud, on your own laptop</p>
        </div>

        {!status && !error && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {status && (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && !status.hasUsers && (
              <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">
                Welcome! The first account you create becomes the <b>owner</b> of this cloud.
              </p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : undefined}
                required
              />
              {mode === 'register' && <p className="mt-1 text-xs text-slate-400">At least 8 characters</p>}
            </div>
            {error && <ErrorBox message={error} />}
            <Button type="submit" loading={busy} className="w-full">
              {mode === 'login' ? 'Log in' : 'Create account'}
            </Button>
            {status.hasUsers && status.registrationOpen && (
              <p className="text-center text-sm text-slate-500">
                {mode === 'login' ? 'No account? ' : 'Already have one? '}
                <button
                  type="button"
                  className="text-indigo-600 underline"
                  onClick={() => {
                    setError('');
                    setMode(mode === 'login' ? 'register' : 'login');
                  }}
                >
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            )}
          </form>
        )}
        {!status && error && <ErrorBox message={error} />}
      </div>
    </div>
  );
}
