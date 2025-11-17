import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-1_9SfZWZEAH',
  ClientId: '5h87m4j2ab9lanjq9ks466sbj9',
};

export const cognitoConfig = {
  region: 'us-east-1',
  userPoolId: poolData.UserPoolId,
  clientId: poolData.ClientId,
};

export const userPool = new CognitoUserPool(poolData);
