import type { AuthTokens } from './types';

let cachedTokens: AuthTokens | null = null;

export const setAuthTokens = (tokens: AuthTokens | null) => {
  cachedTokens = tokens;
};

export const getAuthTokens = () => cachedTokens;
