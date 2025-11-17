import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyMock = vi.fn();
const createMock = vi.fn(() => ({ verify: verifyMock }));

vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: createMock,
  },
}));

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: '',
  rawPath: '',
  rawQueryString: '',
  headers: { Authorization: 'Bearer token-123' },
  requestContext: {} as unknown as APIGatewayProxyEventV2['requestContext'],
  isBase64Encoded: false,
  ...overrides,
});

const importAuth = () => import('../src/auth');

describe('resolveUserId', () => {
  beforeEach(() => {
    vi.resetModules();
    verifyMock.mockReset();
    createMock.mockClear();
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_test';
    process.env.COGNITO_USER_POOL_CLIENT_ID = 'client-123';
  });

  it('returns the sub claim when username is missing', async () => {
    verifyMock.mockResolvedValue({ sub: 'user-123' });
    const { resolveUserId } = await importAuth();

    await expect(resolveUserId(baseEvent())).resolves.toBe('user-123');
    expect(createMock).toHaveBeenCalledWith({
      userPoolId: 'us-east-1_test',
      tokenUse: 'id',
      clientId: 'client-123',
    });
    expect(verifyMock).toHaveBeenCalledWith('token-123');
  });

  it('prefers the Cognito username claim when available', async () => {
    verifyMock.mockResolvedValue({ sub: 'user-123', 'cognito:username': 'email@example.com' });
    const { resolveUserId } = await importAuth();

    await expect(resolveUserId(baseEvent())).resolves.toBe('email@example.com');
  });

  it('throws UnauthorizedError when Authorization header is missing', async () => {
    const { resolveUserId, UnauthorizedError } = await importAuth();

    await expect(resolveUserId(baseEvent({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedError);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when the token cannot be verified', async () => {
    verifyMock.mockRejectedValue(new Error('invalid token'));
    const { resolveUserId, UnauthorizedError } = await importAuth();

    await expect(resolveUserId(baseEvent())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('reuses the verifier across invocations', async () => {
    verifyMock.mockResolvedValue({ sub: 'user-123' });
    const { resolveUserId } = await importAuth();

    await resolveUserId(baseEvent());
    await resolveUserId(baseEvent());

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to default pool values when env vars are unset', async () => {
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_USER_POOL_CLIENT_ID;
    verifyMock.mockResolvedValue({ sub: 'user-123' });

    const { resolveUserId } = await importAuth();

    await resolveUserId(baseEvent());
    expect(createMock).toHaveBeenCalledWith({
      userPoolId: 'us-east-1_9SfZWZEAH',
      tokenUse: 'id',
      clientId: '5h87m4j2ab9lanjq9ks466sbj9',
    });
  });
});
