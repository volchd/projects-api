import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

vi.hoisted(() => {
  process.env.TABLE_NAME = 'ProjectsTable';
});

vi.mock('../src/dynamodb', () => {
  return {
    ddbDocClient: {
      send: vi.fn(),
    },
  };
});

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid'),
}));

import { create, get, listByUser, update, remove } from '../src/projects';
import { ddbDocClient } from '../src/dynamodb';
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
        body: JSON.stringify({ name: null, description: 10 }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'name (string) is required',
      'description must be a string if provided',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 400 when body contains invalid JSON', async () => {
    const response = await create(
      baseEvent({
        body: '{invalid',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'Invalid JSON body',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('persists a new project and returns 201', async () => {
    sendMock.mockResolvedValueOnce({});
    randomUUIDMock.mockReturnValueOnce('project-123');

    const response = await create(
      baseEvent({
        body: JSON.stringify({ name: 'My Project' }),
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-123',
      userId: 'demo-user',
      name: 'My Project',
      description: null,
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      ConditionExpression: 'attribute_not_exists(PK)',
      Item: {
        PK: 'PROJECT#project-123',
        SK: 'PROJECT',
        projectId: 'project-123',
        id: 'project-123',
        userId: 'demo-user',
        name: 'My Project',
        description: null,
        entityType: 'Project',
        GSI1PK: 'USER#demo-user',
        GSI1SK: 'PROJECT#project-123',
      },
    });
  });

  it('returns 500 when DynamoDB call fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('write failure'));
    randomUUIDMock.mockReturnValueOnce('project-uuid');
    randomUUIDMock.mockReturnValueOnce('error-uuid');

    const response = await create(
      baseEvent({
        body: JSON.stringify({ name: 'My Project' }),
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(parseBody<{ message: string; requestId: string }>(response.body)).toEqual({
      message: 'Internal server error',
      requestId: 'error-uuid',
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
      Item: {
        PK: 'PROJECT#project-1',
        SK: 'PROJECT',
        projectId: 'project-1',
        userId: 'demo-user',
        name: 'Proj',
        description: null,
      },
    });

    const response = await get(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-1',
      userId: 'demo-user',
      name: 'Proj',
      description: null,
    });

    const command = sendMock.mock.calls[0][0] as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'PROJECT' },
    });
  });
});

describe('listByUser', () => {
  it('returns user projects', async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        {
          PK: 'PROJECT#a',
          SK: 'PROJECT',
          projectId: 'a',
          userId: 'demo-user',
          name: 'First',
          description: null,
        },
        {
          PK: 'PROJECT#b',
          SK: 'PROJECT',
          projectId: 'b',
          userId: 'demo-user',
          name: 'Second',
          description: 'desc',
        },
      ],
    });

    const response = await listByUser(baseEvent());

    expect(response.statusCode).toBe(200);
    expect(parseBody<{ items: Array<Record<string, unknown>> }>(response.body)).toEqual({
      items: [
        { id: 'a', userId: 'demo-user', name: 'First', description: null },
        { id: 'b', userId: 'demo-user', name: 'Second', description: 'desc' },
      ],
    });

    const command = sendMock.mock.calls[0][0] as QueryCommand;
    expect(command).toBeInstanceOf(QueryCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'USER#demo-user' },
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

  it('returns 400 when body contains invalid JSON', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: '{bad',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'Invalid JSON body',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('validates description type', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ description: 123 }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'description must be a string or null if provided',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('updates provided fields', async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: {
        PK: 'PROJECT#project-1',
        SK: 'PROJECT',
        projectId: 'project-1',
        userId: 'demo-user',
        name: 'Updated',
        description: 'Changed',
      },
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
      userId: 'demo-user',
      name: 'Updated',
      description: 'Changed',
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'PROJECT' },
      ConditionExpression: 'attribute_exists(PK)',
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

  it('allows clearing the description field with null', async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: {
        PK: 'PROJECT#project-1',
        SK: 'PROJECT',
        projectId: 'project-1',
        userId: 'demo-user',
        description: null,
        name: 'Existing',
      },
    });

    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ description: null }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-1',
      userId: 'demo-user',
      name: 'Existing',
      description: null,
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':desc': null,
    });
    expect(command.input).toMatchObject({
      UpdateExpression: 'SET #d = :desc',
      ExpressionAttributeNames: { '#d': 'description' },
    });
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
    sendMock
      .mockResolvedValueOnce({
        Item: {
          PK: 'PROJECT#project-1',
          SK: 'PROJECT',
          projectId: 'project-1',
          userId: 'demo-user',
          name: 'Existing',
          description: null,
        },
      })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({});

    const response = await remove(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(204);
    expect(response.body).toBeUndefined();

    expect(sendMock).toHaveBeenCalledTimes(3);
    const deleteCommand = sendMock.mock.calls[2][0] as DeleteCommand;
    expect(deleteCommand).toBeInstanceOf(DeleteCommand);
    expect(deleteCommand.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'PROJECT' },
      ConditionExpression: 'attribute_exists(PK)',
    });
  });

  it('returns 404 when project is missing', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });

    const response = await remove(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });

  it('returns 404 when delete fails due to a conditional check', async () => {
    const error = new Error('missing');
    (error as { name: string }).name = 'ConditionalCheckFailedException';

    sendMock
      .mockResolvedValueOnce({
        Item: {
          PK: 'PROJECT#project-1',
          SK: 'PROJECT',
          projectId: 'project-1',
          userId: 'demo-user',
          name: 'Existing',
          description: null,
        },
      })
      .mockResolvedValueOnce({ Items: [] })
      .mockRejectedValueOnce(error);

    const response = await remove(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });
});
