import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

vi.hoisted(() => {
  process.env.TABLE_NAME = 'ProjectsTable';
});

vi.mock('./dynamodb', () => {
  return {
    ddbDocClient: {
      send: vi.fn(),
    },
  };
});

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid'),
}));

import { create, get, listByUser, update, remove } from './projects';
import { ddbDocClient } from './dynamodb';
import { randomUUID } from 'node:crypto';

type MockSend = ReturnType<typeof vi.fn>;

const sendMock = ddbDocClient.send as unknown as MockSend;
const randomUUIDMock = randomUUID as unknown as ReturnType<typeof vi.fn>;

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

const parseBody = <T>(responseBody: string | undefined): T =>
  JSON.parse(responseBody ?? '{}') as T;

beforeEach(() => {
  sendMock.mockReset();
  randomUUIDMock.mockReset();
  randomUUIDMock.mockReturnValue('generated-uuid');
});

describe('create', () => {
  it('returns 400 when body is missing', async () => {
    const response = await create(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toContain('Missing JSON body');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('validates required fields', async () => {
    const response = await create(
      baseEvent({
        body: JSON.stringify({ userId: 1, name: null, description: 10 }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'userId (string) is required',
      'name (string) is required',
      'description must be a string if provided',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('persists a new project and returns 201', async () => {
    sendMock.mockResolvedValueOnce({});
    randomUUIDMock.mockReturnValueOnce('project-123');

    const response = await create(
      baseEvent({
        body: JSON.stringify({ userId: 'user-1', name: 'My Project' }),
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-123',
      userId: 'user-1',
      name: 'My Project',
      description: null,
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      ConditionExpression: 'attribute_not_exists(id)',
      Item: {
        id: 'project-123',
        userId: 'user-1',
        name: 'My Project',
        description: null,
      },
    });
  });

  it('returns 500 when DynamoDB call fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('write failure'));

    const response = await create(
      baseEvent({
        body: JSON.stringify({ userId: 'user-1', name: 'My Project' }),
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(parseBody<{ message: string; error: string }>(response.body)).toEqual({
      message: 'Internal server error',
      error: 'write failure',
    });
  });
});

describe('get', () => {
  it('requires id in the path', async () => {
    const response = await get(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'id path parameter is required',
    });
  });

  it('returns 404 when the project is missing', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });

    const response = await get(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });

  it('returns the project when found', async () => {
    sendMock.mockResolvedValueOnce({
      Item: { id: 'project-1', name: 'Proj' },
    });

    const response = await get(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-1',
      name: 'Proj',
    });

    const command = sendMock.mock.calls[0][0] as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { id: 'project-1' },
    });
  });
});

describe('listByUser', () => {
  it('requires userId in the path', async () => {
    const response = await listByUser(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'userId path parameter is required',
    });
  });

  it('returns user projects', async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        { id: 'a', userId: 'user-1', name: 'First' },
        { id: 'b', userId: 'user-1', name: 'Second' },
      ],
    });

    const response = await listByUser(
      baseEvent({
        pathParameters: { userId: 'user-1' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<{ items: Array<Record<string, unknown>> }>(response.body)).toEqual({
      items: [
        { id: 'a', userId: 'user-1', name: 'First' },
        { id: 'b', userId: 'user-1', name: 'Second' },
      ],
    });

    const command = sendMock.mock.calls[0][0] as QueryCommand;
    expect(command).toBeInstanceOf(QueryCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': 'user-1' },
    });
  });
});

describe('update', () => {
  it('returns 400 when id is missing', async () => {
    const response = await update(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'id path parameter is required',
    });
  });

  it('returns 400 when there is nothing to update', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'Nothing to update',
    });
  });

  it('updates provided fields', async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: { id: 'project-1', name: 'Updated', description: 'Changed' },
    });

    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ name: 'Updated', description: 'Changed' }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-1',
      name: 'Updated',
      description: 'Changed',
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { id: 'project-1' },
      ConditionExpression: 'attribute_exists(id)',
      UpdateExpression: 'SET #n = :name, #d = :desc',
      ExpressionAttributeNames: { '#n': 'name', '#d': 'description' },
      ExpressionAttributeValues: { ':name': 'Updated', ':desc': 'Changed' },
      ReturnValues: 'ALL_NEW',
    });
  });

  it('returns 404 when project does not exist', async () => {
    const error = new Error('not found');
    (error as { name: string }).name = 'ConditionalCheckFailedException';
    sendMock.mockRejectedValueOnce(error);

    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ name: 'Updated' }),
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });
});

describe('remove', () => {
  it('returns 400 when id is missing', async () => {
    const response = await remove(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'id path parameter is required',
    });
  });

  it('removes an existing project', async () => {
    sendMock.mockResolvedValueOnce({});

    const response = await remove(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(204);
    expect(parseBody<Record<string, never>>(response.body)).toEqual({});

    const command = sendMock.mock.calls[0][0] as DeleteCommand;
    expect(command).toBeInstanceOf(DeleteCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { id: 'project-1' },
      ConditionExpression: 'attribute_exists(id)',
    });
  });

  it('returns 404 when delete fails due to missing project', async () => {
    const error = new Error('missing');
    (error as { name: string }).name = 'ConditionalCheckFailedException';
    sendMock.mockRejectedValueOnce(error);

    const response = await remove(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });
});
