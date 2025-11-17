import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { cognitoConfig } from '../auth/cognitoClient';

type Mode = 'login' | 'register' | 'confirm';

const INITIAL_FORM = {
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
};

export const AuthScreen = () => {
  const { login, register, confirmRegistration, resendConfirmationCode } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const resetForMode = (
    nextMode: Mode,
    { preserveEmail, preserveFeedback }: { preserveEmail?: boolean; preserveFeedback?: boolean } = {},
  ) => {
    if (!preserveFeedback) {
      setError(null);
      setStatusMessage(null);
    }
    setForm((previous) => {
      if (preserveEmail) {
        return { ...INITIAL_FORM, email: previous.email };
      }
      return { ...INITIAL_FORM };
    });
    setMode(nextMode);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!form.email) {
      setError('Email is required.');
      return;
    }

    if (mode !== 'confirm' && !form.password) {
      setError('Email and password are required.');
      return;
    }

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }

    if (mode === 'confirm' && !form.code) {
      setError('Verification code is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else if (mode === 'register') {
        await register(form.email, form.password);
        setStatusMessage('Account created. Enter the verification code we emailed to you.');
        resetForMode('confirm', { preserveEmail: true, preserveFeedback: true });
      } else {
        await confirmRegistration(form.email, form.code);
        setStatusMessage('Email confirmed. You can sign in now.');
        resetForMode('login', { preserveEmail: true, preserveFeedback: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete request.';
      const normalized = message.toLowerCase();
      if (mode === 'login' && normalized.includes('not confirmed')) {
        setError(null);
        setStatusMessage('You need to verify your email before signing in. Enter the code we sent you.');
        resetForMode('confirm', { preserveEmail: true, preserveFeedback: true });
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    if (mode === 'login') {
      resetForMode('register');
      return;
    }

    resetForMode('login');
  };

  const handleResendCode = async () => {
    if (!form.email) {
      setError('Enter your email to resend the verification code.');
      return;
    }

    setError(null);
    setStatusMessage(null);
    setIsResendingCode(true);
    try {
      await resendConfirmationCode(form.email);
      setStatusMessage('We sent you another code. Check your inbox.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to resend code.';
      setError(message);
    } finally {
      setIsResendingCode(false);
    }
  };

  const formHeading =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'register'
        ? 'Create your account'
        : 'Verify your email';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-300">
            Projects Platform
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{formHeading}</h1>
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
          {mode !== 'confirm' ? (
            <>
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
            </>
          ) : (
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={form.code}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm uppercase tracking-[0.3em] text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/10 dark:text-white"
                placeholder="123456"
                required
              />
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResendingCode}
                className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-400"
              >
                {isResendingCode ? 'Sending code…' : 'Resend code'}
              </button>
            </div>
          )}
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
                : mode === 'register'
                  ? 'Create account'
                  : 'Verify email'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-300">
          {mode === 'login'
            ? 'Need an account?'
            : mode === 'register'
              ? 'Already have an account?'
              : 'Already confirmed your email?'}{' '}
          {mode === 'confirm' ? (
            <button
              type="button"
              className="font-semibold text-indigo-600 dark:text-indigo-400"
              onClick={() => resetForMode('login', { preserveEmail: true })}
            >
              Go to sign in
            </button>
          ) : (
            <button type="button" className="font-semibold text-indigo-600 dark:text-indigo-400" onClick={toggleMode}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          )}
        </p>
        {mode !== 'confirm' ? (
          <p className="text-center text-sm text-slate-500 dark:text-slate-300">
            Already registered but still need to verify your email?{' '}
            <button
              type="button"
              className="font-semibold text-indigo-600 dark:text-indigo-400"
              onClick={() => resetForMode('confirm', { preserveEmail: true })}
            >
              Enter your code
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
};
