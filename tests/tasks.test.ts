import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

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
  randomUUID: vi.fn(() => 'uuid-default'),
}));

import { create, get, listByProject, remove, update } from '../src/tasks';
import { ddbDocClient } from '../src/dynamodb';
import { randomUUID } from 'node:crypto';

type MockSend = ReturnType<typeof vi.fn>;

const sendMock = ddbDocClient.send as unknown as MockSend;
const randomUUIDMock = randomUUID as unknown as ReturnType<typeof vi.fn>;

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 => ({
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
  randomUUIDMock.mockReturnValue('generated-task-id');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('create', () => {
  it('requires projectId', async () => {
    const response = await create(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'projectId path parameter is required',
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing', async () => {
    const response = await create(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toContain('Missing JSON body');
  });

  it('validates payload', async () => {
    const response = await create(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
        body: JSON.stringify({ name: null, description: 123 }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'name (string) is required',
      'description must be a string if provided',
    ]);
  });

  it('returns 404 when project is missing', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });

    const response = await create(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
        body: JSON.stringify({ name: 'Task' }),
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'Project not found',
    });

    const command = sendMock.mock.calls[0][0] as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'PROJECT' },
    });
  });

  it('creates a task', async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: {
          PK: 'PROJECT#project-1',
          SK: 'PROJECT',
          projectId: 'project-1',
          userId: 'demo-user',
        },
      })
      .mockResolvedValueOnce({});
    randomUUIDMock.mockReturnValueOnce('task-123');

    const response = await create(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
        body: JSON.stringify({ name: 'Write docs' }),
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      projectId: 'project-1',
      taskId: 'task-123',
      name: 'Write docs',
      description: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(sendMock).toHaveBeenCalledTimes(2);
    const putCommand = sendMock.mock.calls[1][0] as PutCommand;
    expect(putCommand).toBeInstanceOf(PutCommand);
    expect(putCommand.input).toMatchObject({
      TableName: 'ProjectsTable',
      ConditionExpression: 'attribute_not_exists(PK)',
    });
    expect(putCommand.input.Item).toMatchObject({
      PK: 'PROJECT#project-1',
      SK: 'TASK#task-123',
      projectId: 'project-1',
      taskId: 'task-123',
      userId: 'demo-user',
      name: 'Write docs',
      description: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });
});

describe('get', () => {
  it('requires both projectId and taskId', async () => {
    const missingProject = await get(baseEvent());
    expect(missingProject.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(missingProject.body)).toEqual({
      message: 'projectId path parameter is required',
    });

    const missingTask = await get(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
      }),
    );

    expect(missingTask.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(missingTask.body)).toEqual({
      message: 'taskId path parameter is required',
    });
  });

  it('returns 404 when task is missing', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });

    const response = await get(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-2' },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });

  it('returns the task when present', async () => {
    sendMock.mockResolvedValueOnce({
      Item: {
        PK: 'PROJECT#project-1',
        SK: 'TASK#task-2',
        projectId: 'project-1',
        taskId: 'task-2',
        userId: 'demo-user',
        name: 'Existing task',
        description: 'Details',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    });

    const response = await get(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-2' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      projectId: 'project-1',
      taskId: 'task-2',
      name: 'Existing task',
      description: 'Details',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    const command = sendMock.mock.calls[0][0] as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'TASK#task-2' },
    });
  });
});

describe('listByProject', () => {
  it('requires projectId', async () => {
    const response = await listByProject(baseEvent());

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'projectId path parameter is required',
    });
  });

  it('returns 404 when project is missing', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });

    const response = await listByProject(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({
      message: 'Project not found',
    });
  });

  it('lists tasks for the project', async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: {
          PK: 'PROJECT#project-1',
          SK: 'PROJECT',
          projectId: 'project-1',
          userId: 'demo-user',
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            PK: 'PROJECT#project-1',
            SK: 'TASK#task-1',
            projectId: 'project-1',
            taskId: 'task-1',
            userId: 'demo-user',
            name: 'Task A',
            description: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            PK: 'PROJECT#project-1',
            SK: 'TASK#task-2',
            projectId: 'project-1',
            taskId: 'task-2',
            userId: 'demo-user',
            name: 'Task B',
            description: 'details',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

    const response = await listByProject(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<{ items: Array<Record<string, unknown>> }>(response.body)).toEqual({
      items: [
        {
          projectId: 'project-1',
          taskId: 'task-1',
          name: 'Task A',
          description: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          projectId: 'project-1',
          taskId: 'task-2',
          name: 'Task B',
          description: 'details',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(sendMock).toHaveBeenCalledTimes(2);
    const queryCommand = sendMock.mock.calls[1][0] as QueryCommand;
    expect(queryCommand).toBeInstanceOf(QueryCommand);
    expect(queryCommand.input).toMatchObject({
      TableName: 'ProjectsTable',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :taskPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'PROJECT#project-1',
        ':taskPrefix': 'TASK#',
      },
    });
  });
});

describe('update', () => {
  it('requires identifiers', async () => {
    const noProject = await update(baseEvent());
    expect(noProject.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(noProject.body)).toEqual({
      message: 'projectId path parameter is required',
    });

    const noTask = await update(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
      }),
    );

    expect(noTask.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(noTask.body)).toEqual({
      message: 'taskId path parameter is required',
    });
  });

  it('validates input', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-1' },
        body: JSON.stringify({ description: 123 }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toEqual([
      'description must be a string or null if provided',
    ]);
  });

  it('requires body content', async () => {
    const missingBody = await update(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-1' },
      }),
    );

    expect(missingBody.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(missingBody.body).errors).toContain('Missing JSON body');
  });

  it('returns 400 when there is nothing to update', async () => {
    const response = await update(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-1' },
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
      Attributes: {
        PK: 'PROJECT#project-1',
        SK: 'TASK#task-1',
        projectId: 'project-1',
        taskId: 'task-1',
        userId: 'demo-user',
        name: 'Updated name',
        description: 'Updated description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    });

    const response = await update(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-1' },
        body: JSON.stringify({ name: 'Updated name', description: 'Updated description' }),
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(response.body)).toEqual({
      projectId: 'project-1',
      taskId: 'task-1',
      name: 'Updated name',
      description: 'Updated description',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    const command = sendMock.mock.calls[0][0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input.TableName).toBe('ProjectsTable');
    expect(command.input.Key).toMatchObject({ PK: 'PROJECT#project-1', SK: 'TASK#task-1' });
    expect(command.input.ConditionExpression).toBe('attribute_exists(PK) AND userId = :user');
    expect(command.input.ReturnValues).toBe('ALL_NEW');

    expect(command.input.ExpressionAttributeNames).toMatchObject({
      '#n': 'name',
      '#d': 'description',
      '#u': 'updatedAt',
    });

    const values = command.input.ExpressionAttributeValues ?? {};
    expect(values).toMatchObject({
      ':name': 'Updated name',
      ':desc': 'Updated description',
      ':user': 'demo-user',
    });
    expect(typeof values[':updatedAt']).toBe('string');
  });

  it('returns 404 when task does not exist', async () => {
    const error = new Error('missing');
    (error as { name: string }).name = 'ConditionalCheckFailedException';
    sendMock.mockRejectedValueOnce(error);

    const response = await update(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-1' },
        body: JSON.stringify({ name: 'Updated' }),
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });
});

describe('remove', () => {
  it('requires identifiers', async () => {
    const noProject = await remove(baseEvent());
    expect(noProject.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(noProject.body)).toEqual({
      message: 'projectId path parameter is required',
    });

    const noTask = await remove(
      baseEvent({
        pathParameters: { projectId: 'project-1' },
      }),
    );

    expect(noTask.statusCode).toBe(400);
    expect(parseBody<{ message: string }>(noTask.body)).toEqual({
      message: 'taskId path parameter is required',
    });
  });

  it('deletes the task', async () => {
    sendMock.mockResolvedValueOnce({});

    const response = await remove(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-1' },
      }),
    );

    expect(response.statusCode).toBe(204);
    expect(response.body).toBeUndefined();

    const command = sendMock.mock.calls[0][0] as DeleteCommand;
    expect(command).toBeInstanceOf(DeleteCommand);
    expect(command.input).toMatchObject({
      TableName: 'ProjectsTable',
      Key: { PK: 'PROJECT#project-1', SK: 'TASK#task-1' },
      ConditionExpression: 'attribute_exists(PK) AND userId = :user',
    });
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':user': 'demo-user',
    });
  });

  it('returns 404 when delete fails due to missing task', async () => {
    const error = new Error('missing');
    (error as { name: string }).name = 'ConditionalCheckFailedException';
    sendMock.mockRejectedValueOnce(error);

    const response = await remove(
      baseEvent({
        pathParameters: { projectId: 'project-1', taskId: 'task-1' },
      }),
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody<{ message: string }>(response.body)).toEqual({ message: 'Not found' });
  });
});
