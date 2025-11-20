import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

vi.hoisted(() => {
  process.env.TABLE_NAME = 'ProjectsTable';
});

vi.mock('../src/auth', () => {
  class UnauthorizedError extends Error {}
  return {
    resolveUser: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock('../src/dynamodb', () => {
  return {
    ddbDocClient: {
      send: vi.fn(),
    },
  };
});

import { getProfile, putProfile } from '../src/users';
import { ddbDocClient } from '../src/dynamodb';
import { resolveUser, UnauthorizedError } from '../src/auth';
import type { UserProfile } from '../src/users.types';

type MockSend = ReturnType<typeof vi.fn>;

const sendMock = ddbDocClient.send as unknown as MockSend;
const resolveUserMock = resolveUser as unknown as ReturnType<typeof vi.fn<typeof resolveUser>>;

const baseEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: '',
  rawPath: '',
  rawQueryString: '',
  headers: {},
  requestContext: {} as unknown as APIGatewayProxyEventV2['requestContext'],
  isBase64Encoded: false,
  ...overrides,
});

const parseBody = <T>(body: string | undefined): T => JSON.parse(body ?? '{}') as T;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2023-01-02T03:04:05.000Z'));
  sendMock.mockReset();
  resolveUserMock.mockReset();
  resolveUserMock.mockResolvedValue({
    userId: 'user-123',
    claims: { email: 'ada@example.com' },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('putProfile', () => {
  it('returns 401 when authentication fails', async () => {
    resolveUserMock.mockRejectedValueOnce(new UnauthorizedError('token expired'));

    const response = await putProfile(
      baseEvent({
        body: JSON.stringify({ firstName: 'Ada', lastName: 'Lovelace' }),
      }),
    );

    expect(response.statusCode).toBe(401);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Unauthorized' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('validates missing body', async () => {
    const response = await putProfile(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body)).toEqual({
      errors: ['Missing JSON body'],
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('validates required names', async () => {
    const response = await putProfile(
      baseEvent({
        body: JSON.stringify({ firstName: '', lastName: ' ' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'firstName (string) is required and must be <= 100 characters',
      'lastName (string) is required and must be <= 100 characters',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('persists a profile and returns the saved record', async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: {
        PK: 'USER#user-123',
        SK: 'PROFILE',
        userId: 'user-123',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        createdAt: '2023-01-02T03:04:05.000Z',
        updatedAt: '2023-01-02T03:04:05.000Z',
        entityType: 'UserProfile',
      },
    });

    const response = await putProfile(
      baseEvent({
        body: JSON.stringify({ firstName: 'Ada', lastName: 'Lovelace' }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<UserProfile>(response.body)).toEqual({
      userId: 'user-123',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      createdAt: '2023-01-02T03:04:05.000Z',
      updatedAt: '2023-01-02T03:04:05.000Z',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'USER#user-123', SK: 'PROFILE' },
    });
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':userId': 'user-123',
      ':email': 'ada@example.com',
      ':firstName': 'Ada',
      ':lastName': 'Lovelace',
      ':updatedAt': '2023-01-02T03:04:05.000Z',
      ':createdAt': '2023-01-02T03:04:05.000Z',
      ':entityType': 'UserProfile',
    });
  });
});

describe('getProfile', () => {
  it('returns 401 when authentication fails', async () => {
    resolveUserMock.mockRejectedValueOnce(new UnauthorizedError('missing token'));

    const response = await getProfile(baseEvent());

    expect(response.statusCode).toBe(401);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Unauthorized' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 404 when no profile exists', async () => {
    sendMock.mockResolvedValueOnce({});

    const response = await getProfile(baseEvent());

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Profile not found' });
  });

  it('loads and returns a profile', async () => {
    sendMock.mockResolvedValueOnce({
      Item: {
        PK: 'USER#user-123',
        SK: 'PROFILE',
        userId: 'user-123',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        createdAt: '2023-01-02T03:04:05.000Z',
        updatedAt: '2023-01-02T03:04:05.000Z',
        entityType: 'UserProfile',
      },
    });

    const response = await getProfile(baseEvent());

    expect(response.statusCode).toBe(200);
    expect(parseBody<UserProfile>(response.body)).toEqual({
      userId: 'user-123',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      createdAt: '2023-01-02T03:04:05.000Z',
      updatedAt: '2023-01-02T03:04:05.000Z',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'USER#user-123', SK: 'PROFILE' },
    });
  });
});
