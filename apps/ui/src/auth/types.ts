export type AuthTokens = {
  idToken: string;
  accessToken: string;
};

export type AuthUser = {
  username: string;
  email?: string;
  tokens: AuthTokens;
};
