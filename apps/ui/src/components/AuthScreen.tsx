import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cognitoConfig } from '../auth/cognitoClient';

type Mode = 'login' | 'register';

const INITIAL_FORM = {
  email: '',
  password: '',
  confirmPassword: '',
};

export const AuthScreen = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.email, form.password);
        setStatusMessage('Account created. Check your email for a confirmation link before signing in.');
        setMode('login');
        setForm({ ...INITIAL_FORM, email: form.email });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete request.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setError(null);
    setStatusMessage(null);
    setForm(INITIAL_FORM);
    setMode((previous) => (previous === 'login' ? 'register' : 'login'));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-300">
            Projects Platform
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Cognito pool {cognitoConfig.userPoolId} ({cognitoConfig.region})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleInputChange}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/10 dark:text-white"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={handleInputChange}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/10 dark:text-white"
              placeholder="••••••••"
              required
            />
          </div>
          {mode === 'register' ? (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-600 dark:text-slate-200"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/10 dark:text-white"
                placeholder="••••••••"
                required
              />
            </div>
          ) : null}
          {error ? <p className="text-sm font-medium text-rose-500">{error}</p> : null}
          {statusMessage ? <p className="text-sm font-medium text-emerald-600">{statusMessage}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-600 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-300">
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button type="button" className="font-semibold text-indigo-600 dark:text-indigo-400" onClick={toggleMode}>
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};
