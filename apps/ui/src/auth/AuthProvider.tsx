import type { ReactNode } from 'react';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { userPool } from './cognitoClient';
import type { AuthUser } from './types';
import { setAuthTokens } from './tokenStore';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildUserFromSession = (cognitoUser: CognitoUser, session: CognitoUserSession): AuthUser => {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload() as { email?: string };

  return {
    username: cognitoUser.getUsername(),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    tokens: {
      idToken: idToken.getJwtToken(),
      accessToken: session.getAccessToken().getJwtToken(),
    },
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyUser = useCallback((next: AuthUser | null) => {
    setUser(next);
    setAuthTokens(next ? next.tokens : null);
  }, []);

  const readCurrentUser = useCallback(
    () =>
      new Promise<AuthUser | null>((resolve) => {
        const current = userPool.getCurrentUser();
        if (!current) {
          resolve(null);
          return;
        }

        current.getSession(
          (sessionError: Error | null, session: CognitoUserSession | null) => {
            if (sessionError || !session || !session.isValid()) {
              resolve(null);
              return;
            }
            resolve(buildUserFromSession(current, session));
          },
        );
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const authenticatedUser = await readCurrentUser().catch(() => null);
      if (cancelled) {
        return;
      }
      applyUser(authenticatedUser);
      setIsLoading(false);
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [applyUser, readCurrentUser]);

  const login = useCallback(
    (email: string, password: string) =>
      new Promise<void>((resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });

        const authDetails = new AuthenticationDetails({
          Username: email,
          Password: password,
        });

        cognitoUser.authenticateUser(authDetails, {
          onSuccess: (session) => {
            const authenticated = buildUserFromSession(cognitoUser, session);
            applyUser(authenticated);
            resolve();
          },
          onFailure: (err) => {
            const message =
              err instanceof Error
                ? err.message
                : typeof err?.message === 'string'
                  ? err.message
                  : 'Failed to sign in';
            reject(new Error(message));
          },
        });
      }),
    [applyUser],
  );

  const register = useCallback(
    (email: string, password: string) =>
      new Promise<void>((resolve, reject) => {
        const attributes = [new CognitoUserAttribute({ Name: 'email', Value: email })];

        userPool.signUp(email, password, attributes, [], (err?: Error | null) => {
          if (err) {
            const message = err.message || 'Failed to register';
            reject(new Error(message));
            return;
          }

          resolve();
        });
      }),
    [],
  );

  const confirmRegistration = useCallback(
    (email: string, code: string) =>
      new Promise<void>((resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });

        cognitoUser.confirmRegistration(code, true, (err?: Error | null) => {
          if (err) {
            const message = err.message || 'Failed to confirm account';
            reject(new Error(message));
            return;
          }

          resolve();
        });
      }),
    [],
  );

  const resendConfirmationCode = useCallback(
    (email: string) =>
      new Promise<void>((resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });

        cognitoUser.resendConfirmationCode((err?: Error | null) => {
          if (err) {
            const message = err.message || 'Failed to resend code';
            reject(new Error(message));
            return;
          }

          resolve();
        });
      }),
    [],
  );

  const logout = useCallback(async () => {
    const existing = userPool.getCurrentUser();
    if (existing) {
      existing.signOut();
    }
    applyUser(null);
  }, [applyUser]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      confirmRegistration,
      resendConfirmationCode,
      logout,
    }),
    [user, isLoading, login, register, confirmRegistration, resendConfirmationCode, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
