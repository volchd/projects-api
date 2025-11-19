import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { env } from './config/env';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

type Claims = Record<string, unknown> | undefined;

const extractHeader = (
  headers: APIGatewayProxyEventV2['headers'],
  headerName: string,
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && key.toLowerCase() === target) {
      return value;
    }
  }

  return undefined;
};

const extractBearerToken = (headers: APIGatewayProxyEventV2['headers']): string | null => {
  const headerValue = extractHeader(headers, 'authorization');
  if (!headerValue) {
    return null;
  }

  const [scheme, ...rest] = headerValue.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  const token = rest.join(' ').trim();
  return token.length ? token : null;
};

const userIdFromClaims = (claims: Claims): string | null => {
  if (!claims) {
    return null;
  }

  const username = claims['cognito:username'];
  if (typeof username === 'string' && username.trim().length) {
    return username;
  }

  const sub = claims.sub;
  if (typeof sub === 'string' && sub.trim().length) {
    return sub;
  }

  return null;
};

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

const getVerifier = () => {
  if (!verifier) {
    const { userPoolId, userPoolClientId } = env.cognito;
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId: userPoolClientId,
    });
  }

  return verifier;
};

export const resolveUserId = async (event: APIGatewayProxyEventV2): Promise<string> => {
  const token = extractBearerToken(event.headers);
  if (!token) {
    throw new UnauthorizedError('Missing bearer token');
  }

  let claims: Claims;
  try {
    claims = (await getVerifier().verify(token)) as Claims;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const userId = userIdFromClaims(claims);
  if (!userId) {
    throw new UnauthorizedError('Token does not include a user identifier');
  }

  return userId;
};
