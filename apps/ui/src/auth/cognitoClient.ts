import { CognitoUserPool } from 'amazon-cognito-identity-js';

const requireEnv = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing Cognito environment variable: ${name}`);
  }

  return value;
};

const region = requireEnv(import.meta.env.VITE_COGNITO_REGION, 'VITE_COGNITO_REGION');
const userPoolId = requireEnv(import.meta.env.VITE_COGNITO_USER_POOL_ID, 'VITE_COGNITO_USER_POOL_ID');
const clientId = requireEnv(import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID, 'VITE_COGNITO_USER_POOL_CLIENT_ID');

const poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId,
};

export const cognitoConfig = {
  region,
  userPoolId,
  clientId,
};

export const userPool = new CognitoUserPool(poolData);
