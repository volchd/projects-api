import { CognitoUserPool } from 'amazon-cognito-identity-js';

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_USER_POOL_ID = 'us-east-1_9SfZWZEAH';
const DEFAULT_CLIENT_ID = '5h87m4j2ab9lanjq9ks466sbj9';

const region = import.meta.env.VITE_COGNITO_REGION || DEFAULT_REGION;
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || DEFAULT_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || DEFAULT_CLIENT_ID;

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
