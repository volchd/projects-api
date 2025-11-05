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
import { DEFAULT_PROJECT_STATUSES } from '../src/projects.types';

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
      statuses: DEFAULT_PROJECT_STATUSES,
      labels: [],
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
        statuses: DEFAULT_PROJECT_STATUSES,
        labels: [],
      },
    });
  });

  it('accepts custom statuses on create', async () => {
    sendMock.mockResolvedValueOnce({});
    randomUUIDMock.mockReturnValueOnce('project-custom-status');

    const response = await create(
      baseEvent({
        body: JSON.stringify({ name: 'With statuses', statuses: [' backlog', 'In QA'] }),
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-custom-status',
      userId: 'demo-user',
      name: 'With statuses',
      description: null,
      statuses: ['BACKLOG', 'IN QA'],
      labels: [],
    });

    const command = sendMock.mock.calls[0][0] as PutCommand;
    expect(command.input.Item?.statuses).toEqual(['BACKLOG', 'IN QA']);
    expect(command.input.Item?.labels).toEqual([]);
  });

  it('accepts labels on create', async () => {
    sendMock.mockResolvedValueOnce({});
    randomUUIDMock.mockReturnValueOnce('project-with-labels');

    const response = await create(
      baseEvent({
        body: JSON.stringify({
          name: 'With labels',
          labels: [' Docs ', 'Design', 'Support'],
        }),
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-with-labels',
      userId: 'demo-user',
      name: 'With labels',
      description: null,
      statuses: DEFAULT_PROJECT_STATUSES,
      labels: ['Design', 'Docs', 'Support'],
    });

    const command = sendMock.mock.calls[0][0] as PutCommand;
    expect(command.input.Item?.labels).toEqual(['Design', 'Docs', 'Support']);
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
      statuses: DEFAULT_PROJECT_STATUSES,
      labels: [],
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
          statuses: DEFAULT_PROJECT_STATUSES,
          labels: [],
        },
        {
          PK: 'PROJECT#b',
          SK: 'PROJECT',
          projectId: 'b',
          userId: 'demo-user',
          name: 'Second',
          description: 'desc',
          statuses: DEFAULT_PROJECT_STATUSES,
          labels: [],
        },
      ],
    });

    const response = await listByUser(baseEvent());

    expect(response.statusCode).toBe(200);
    expect(parseBody<{ items: Array<Record<string, unknown>> }>(response.body)).toEqual({
      items: [
        {
          id: 'a',
          userId: 'demo-user',
          name: 'First',
          description: null,
          statuses: DEFAULT_PROJECT_STATUSES,
          labels: [],
        },
        {
          id: 'b',
          userId: 'demo-user',
          name: 'Second',
          description: 'desc',
          statuses: DEFAULT_PROJECT_STATUSES,
          labels: [],
        },
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

  it('validates statuses payload', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ statuses: 'not-an-array' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toContain(
      'statuses must be an array of non-empty strings if provided',
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('validates labels payload', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ labels: 'not-an-array' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toContain(
      'labels must be an array of non-empty strings if provided',
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects invalid statuses entries', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ statuses: ['   ', null] }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'statuses must contain non-empty strings up to 40 characters',
      'statuses must include at least one value',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate statuses', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ statuses: ['Todo', 'TODO'] }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'statuses must contain unique values',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate labels', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ labels: ['Docs', 'docs'] }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'labels must contain unique values',
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
        statuses: DEFAULT_PROJECT_STATUSES,
        labels: [],
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
      statuses: DEFAULT_PROJECT_STATUSES,
      labels: [],
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'PROJECT' },
      ConditionExpression: 'attribute_exists(PK)',
      UpdateExpression: 'SET #n = :name, #d = :desc, #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#n': 'name', '#d': 'description', '#updatedAt': 'updatedAt' },
      ReturnValues: 'ALL_NEW',
    });
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':name': 'Updated',
      ':desc': 'Changed',
      ':updatedAt': expect.any(String),
    });
  });

  it('updates statuses while preserving order', async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: {
        PK: 'PROJECT#project-1',
        SK: 'PROJECT',
        projectId: 'project-1',
        userId: 'demo-user',
        name: 'Existing',
        description: null,
        statuses: ['PLANNING', 'IN REVIEW', 'DONE'],
        labels: [],
      },
    });

    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ statuses: [' planning ', 'IN  review', 'done'] }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-1',
      userId: 'demo-user',
      name: 'Existing',
      description: null,
      statuses: ['PLANNING', 'IN REVIEW', 'DONE'],
      labels: [],
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input).toMatchObject({
      UpdateExpression: 'SET #s = :statuses, #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#s': 'statuses', '#updatedAt': 'updatedAt' },
    });
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':statuses': ['PLANNING', 'IN REVIEW', 'DONE'],
      ':updatedAt': expect.any(String),
    });
  });

  it('updates labels', async () => {
    sendMock.mockResolvedValueOnce({
      Attributes: {
        PK: 'PROJECT#project-1',
        SK: 'PROJECT',
        projectId: 'project-1',
        userId: 'demo-user',
        name: 'Existing',
        description: null,
        statuses: DEFAULT_PROJECT_STATUSES,
        labels: ['Docs', 'Support'],
      },
    });

    const response = await update(
      baseEvent({
        pathParameters: { id: 'project-1' },
        body: JSON.stringify({ labels: ['Docs', ' Support '] }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      id: 'project-1',
      userId: 'demo-user',
      name: 'Existing',
      description: null,
      statuses: DEFAULT_PROJECT_STATUSES,
      labels: ['Docs', 'Support'],
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input.UpdateExpression).toContain('#l = :labels');
    expect(command.input.ExpressionAttributeNames).toMatchObject({
      '#l': 'labels',
    });
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':labels': ['Docs', 'Support'],
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
        statuses: DEFAULT_PROJECT_STATUSES,
        labels: [],
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
      statuses: DEFAULT_PROJECT_STATUSES,
      labels: [],
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':desc': null,
      ':updatedAt': expect.any(String),
    });
    expect(command.input).toMatchObject({
      UpdateExpression: 'SET #d = :desc, #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#d': 'description', '#updatedAt': 'updatedAt' },
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
          labels: [],
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

  it('removes any tasks for the project before deleting it', async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: {
          PK: 'PROJECT#project-1',
          SK: 'PROJECT',
          projectId: 'project-1',
          userId: 'demo-user',
          name: 'Existing',
          description: null,
          labels: [],
        },
      })
      .mockResolvedValueOnce({
        Items: [
          { PK: 'PROJECT#project-1', SK: 'TASK#task-1' },
          { PK: 'PROJECT#project-1', SK: 'TASK#task-2' },
        ],
        LastEvaluatedKey: { PK: 'PROJECT#project-1', SK: 'TASK#task-2' },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({});

    const response = await remove(
      baseEvent({
        pathParameters: { id: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(204);
    expect(sendMock).toHaveBeenCalledTimes(6);

    const firstQuery = sendMock.mock.calls[1][0] as QueryCommand;
    expect(firstQuery).toBeInstanceOf(QueryCommand);
    expect(firstQuery.input).toMatchObject({
      TableName: 'ProjectsTable',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :taskPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'PROJECT#project-1',
        ':taskPrefix': 'TASK#',
      },
    });

    const deleteTask1 = sendMock.mock.calls[2][0] as DeleteCommand;
    const deleteTask2 = sendMock.mock.calls[3][0] as DeleteCommand;
    expect(deleteTask1).toBeInstanceOf(DeleteCommand);
    expect(deleteTask2).toBeInstanceOf(DeleteCommand);
    expect(deleteTask1.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'TASK#task-1' },
    });
    expect(deleteTask2.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'TASK#task-2' },
    });

    const secondQuery = sendMock.mock.calls[4][0] as QueryCommand;
    expect(secondQuery).toBeInstanceOf(QueryCommand);
    expect(secondQuery.input).toMatchObject({
      TableName: 'ProjectsTable',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :taskPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'PROJECT#project-1',
        ':taskPrefix': 'TASK#',
      },
      ExclusiveStartKey: { PK: 'PROJECT#project-1', SK: 'TASK#task-2' },
    });

    const deleteProjectCommand = sendMock.mock.calls[5][0] as DeleteCommand;
    expect(deleteProjectCommand).toBeInstanceOf(DeleteCommand);
    expect(deleteProjectCommand.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'PROJECT' },
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
