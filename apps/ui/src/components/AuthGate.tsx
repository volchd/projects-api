import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthScreen } from './AuthScreen';

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12 text-sm font-medium text-slate-500 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white/80">
        Checking your session...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <>{children}</>;
};
