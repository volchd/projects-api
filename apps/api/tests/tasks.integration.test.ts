import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { resolveUserId } from '../src/auth';
import {
  create as createProjectHandler,
  get as getProjectHandler,
  remove as removeProjectHandler,
  update as updateProjectHandler,
} from '../src/projects';
import { DEFAULT_PROJECT_STATUSES } from '../src/projects.types';
import {
  create as createTaskHandler,
  get as getTaskHandler,
  listByProject as listTasksHandler,
  remove as removeTaskHandler,
  update as updateTaskHandler,
} from '../src/tasks';
import { DEFAULT_TASK_PRIORITY } from '../src/tasks.types';
import type { TaskPriority } from '../src/tasks.types';

vi.hoisted(() => {
  process.env.IS_OFFLINE = 'true';
  process.env.AWS_REGION = 'us-east-1';
  process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:8000';
  process.env.TABLE_NAME = `TasksTableTest-${Date.now()}`;
});

const tableName = process.env.TABLE_NAME as string;
let tableCreated = false;

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

const hardcodedUserId = resolveUserId(baseEvent());

interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  statuses: string[];
  labels: string[];
}

interface TaskRecord {
  projectId: string;
  taskId: string;
  name: string;
  description: string | null;
  status: string;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}

interface TaskListResponse {
  items: TaskRecord[];
}

const createProject = async (
  input: Partial<Omit<ProjectRecord, 'id' | 'userId'>> = {},
): Promise<{ statusCode: number; project: ProjectRecord }> => {
  const response = await createProjectHandler(
    baseEvent({
      body: JSON.stringify({
        name: 'Project for tasks integration',
        description: 'Created in tasks integration test',
        ...input,
      }),
    }),
  );

  return {
    statusCode: response.statusCode,
    project: parseBody<ProjectRecord>(response.body),
  };
};

const createTask = async (
  projectId: string,
  input: Partial<Omit<TaskRecord, 'projectId' | 'taskId' | 'createdAt' | 'updatedAt'>> = {},
): Promise<{ statusCode: number; task: TaskRecord }> => {
  const response = await createTaskHandler(
    baseEvent({
      pathParameters: { projectId },
      body: JSON.stringify({
        name: 'Integration Task',
        description: 'Created via integration test',
        ...input,
      }),
    }),
  );

  return {
    statusCode: response.statusCode,
    task: parseBody<TaskRecord>(response.body),
  };
};

describe('tasks integration', () => {
  const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
  });

  const createdTaskIds: string[] = [];
  let project: ProjectRecord | undefined;

  beforeAll(async () => {
    try {
      await dynamoClient.send(new ListTablesCommand({ Limit: 1 }));
    } catch (error) {
      console.error(
        `Integration tests require DynamoDB Local at ${process.env.DYNAMODB_ENDPOINT}. Ensure the local instance is running.`,
      );
      console.error(error);
      throw new Error('DynamoDB Local is not reachable; aborting integration tests.');
    }

    await dynamoClient.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );

    tableCreated = true;

    await waitUntilTableExists(
      { client: dynamoClient, maxWaitTime: 20, minDelay: 1 },
      { TableName: tableName },
    );
  });

  afterAll(async () => {
    if (tableCreated) {
      await dynamoClient.send(
        new DeleteTableCommand({
          TableName: tableName,
        }),
      );
    }
    dynamoClient.destroy();
  });

  beforeEach(async () => {
    const { statusCode, project: created } = await createProject();
    expect(statusCode).toBe(201);
    expect(created.userId).toBe(hardcodedUserId);
    expect(created.statuses).toEqual(DEFAULT_PROJECT_STATUSES);
    expect(created.labels).toEqual([]);
    project = created;
  });

  afterEach(async () => {
    if (project) {
      for (const taskId of createdTaskIds.splice(0)) {
        const response = await removeTaskHandler(
          baseEvent({
            pathParameters: { projectId: project.id, taskId },
          }),
        );

        if (![204, 404].includes(response.statusCode ?? 0)) {
          console.warn(
            `Failed to clean up task ${taskId}: ${response.statusCode} ${response.body}`,
          );
        }
      }

      const response = await removeProjectHandler(
        baseEvent({
          pathParameters: { id: project.id },
        }),
      );

      if (![204, 404].includes(response.statusCode ?? 0)) {
        console.warn(
          `Failed to clean up project ${project.id}: ${response.statusCode} ${response.body}`,
        );
      }
    }

    project = undefined;
    createdTaskIds.length = 0;
  });

  it('creates a task for a project', async () => {
    const { statusCode, task } = await createTask(project!.id);

    expect(statusCode).toBe(201);
    expect(task.projectId).toBe(project!.id);
    expect(task.name).toBe('Integration Task');
    expect(task.description).toBe('Created via integration test');
    expect(typeof task.taskId).toBe('string');
    expect(task.priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(task.startDate).toBeNull();
    expect(task.dueDate).toBeNull();
    expect(task.labels).toEqual([]);
    expect(typeof task.createdAt).toBe('string');
    expect(typeof task.updatedAt).toBe('string');

    createdTaskIds.push(task.taskId);
  });

  it('creates a task with a custom status', async () => {
    const updateResponse = await updateProjectHandler(
      baseEvent({
        pathParameters: { id: project!.id },
        body: JSON.stringify({ statuses: ['BACKLOG', 'IN QA'] }),
      }),
    );
    expect(updateResponse.statusCode).toBe(200);
    project = parseBody<ProjectRecord>(updateResponse.body);
    expect(project.statuses).toEqual(['BACKLOG', 'IN QA']);

    const { statusCode, task } = await createTask(project.id, {
      name: 'Review feature',
      status: 'IN QA',
    });

    expect(statusCode).toBe(201);
    expect(task.status).toBe('IN QA');
    expect(task.priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(task.labels).toEqual([]);
    createdTaskIds.push(task.taskId);
  });

  it('creates a task with optional start and due dates', async () => {
    const startDate = '2030-01-05';
    const dueDate = '2030-01-10';
    const { statusCode, task } = await createTask(project!.id, {
      name: 'With schedule',
      startDate,
      dueDate,
    });

    expect(statusCode).toBe(201);
    expect(task.startDate).toBe(new Date(startDate).toISOString());
    expect(task.dueDate).toBe(new Date(dueDate).toISOString());
    expect(task.priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(task.labels).toEqual([]);
    createdTaskIds.push(task.taskId);
  });

  it('creates a task with a custom priority', async () => {
    const { statusCode, task } = await createTask(project!.id, {
      name: 'Prioritized task',
      priority: 'Urgent',
    });

    expect(statusCode).toBe(201);
    expect(task.priority).toBe('Urgent');
    expect(task.labels).toEqual([]);
    createdTaskIds.push(task.taskId);
  });

  it('creates a task with labels and updates project labels', async () => {
    const { statusCode, task } = await createTask(project!.id, {
      name: 'Document feature',
      labels: ['Docs', 'Support'],
    });

    expect(statusCode).toBe(201);
    expect(task.labels).toEqual(['Docs', 'Support']);
    createdTaskIds.push(task.taskId);

    const projectResponse = await getProjectHandler(
      baseEvent({
        pathParameters: { id: project!.id },
      }),
    );

    expect(projectResponse.statusCode).toBe(200);
    const reloaded = parseBody<ProjectRecord>(projectResponse.body);
    expect(reloaded.labels).toEqual(['Docs', 'Support']);
    project = reloaded;
  });

  it('rejects creating a task when due date is before the start date', async () => {
    const response = await createTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id },
        body: JSON.stringify({
          name: 'Invalid schedule',
          startDate: '2030-01-10',
          dueDate: '2030-01-05',
        }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors?: string[] }>(response.body).errors).toContain(
      'dueDate must be on or after startDate',
    );
  });

  it('retrieves a task by id', async () => {
    const { statusCode, task } = await createTask(project!.id);
    expect(statusCode).toBe(201);
    createdTaskIds.push(task.taskId);

    const response = await getTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id, taskId: task.taskId },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(parseBody<TaskRecord>(response.body)).toEqual(task);
  });

  it('lists tasks for a project', async () => {
    const firstTask = await createTask(project!.id, {
      name: 'First task',
      description: 'First',
    });
    expect(firstTask.statusCode).toBe(201);

    const secondTask = await createTask(project!.id, {
      name: 'Second task',
      description: null,
    });
    expect(secondTask.statusCode).toBe(201);

    createdTaskIds.push(firstTask.task.taskId, secondTask.task.taskId);

    const response = await listTasksHandler(
      baseEvent({
        pathParameters: { projectId: project!.id },
      }),
    );

    expect(response.statusCode).toBe(200);
    const items = parseBody<TaskListResponse>(response.body).items ?? [];

    expect(
      items.some(
        (item) =>
          item.projectId === project!.id &&
          item.taskId === firstTask.task.taskId &&
          item.name === 'First task' &&
          item.description === 'First' &&
          item.priority === DEFAULT_TASK_PRIORITY &&
          Array.isArray(item.labels) &&
          item.labels.length === 0,
      ),
    ).toBe(true);

    expect(
      items.some(
        (item) =>
          item.projectId === project!.id &&
          item.taskId === secondTask.task.taskId &&
          item.name === 'Second task' &&
          item.description === null &&
          item.priority === DEFAULT_TASK_PRIORITY &&
          Array.isArray(item.labels) &&
          item.labels.length === 0,
      ),
    ).toBe(true);
  });

  it('updates a task', async () => {
    const { statusCode, task } = await createTask(project!.id);
    expect(statusCode).toBe(201);
    createdTaskIds.push(task.taskId);

    const response = await updateTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id, taskId: task.taskId },
        body: JSON.stringify({
          name: 'Updated task name',
          description: 'Updated description',
          status: 'COMPLETE',
          startDate: '2035-06-01',
          dueDate: '2035-06-10',
        }),
      }),
    );

    expect(response.statusCode).toBe(200);
    const updated = parseBody<TaskRecord>(response.body);

    expect(updated).toMatchObject({
      projectId: project!.id,
      taskId: task.taskId,
      name: 'Updated task name',
      description: 'Updated description',
      status: 'COMPLETE',
      startDate: new Date('2035-06-01').toISOString(),
      dueDate: new Date('2035-06-10').toISOString(),
    });
    expect(updated.labels).toEqual([]);
    expect(typeof updated.createdAt).toBe('string');
    expect(typeof updated.updatedAt).toBe('string');
  });

  it('updates task labels and syncs project labels', async () => {
    const initial = await createTask(project!.id, {
      name: 'Labelled task',
      labels: ['Docs'],
    });
    expect(initial.statusCode).toBe(201);
    createdTaskIds.push(initial.task.taskId);

    const updateResponse = await updateTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id, taskId: initial.task.taskId },
        body: JSON.stringify({ labels: ['Docs', 'Support'] }),
      }),
    );

    expect(updateResponse.statusCode).toBe(200);
    const updated = parseBody<TaskRecord>(updateResponse.body);
    expect(updated.labels).toEqual(['Docs', 'Support']);

    const projectResponse = await getProjectHandler(
      baseEvent({
        pathParameters: { id: project!.id },
      }),
    );
    expect(projectResponse.statusCode).toBe(200);
    const reloaded = parseBody<ProjectRecord>(projectResponse.body);
    expect(reloaded.labels).toEqual(['Docs', 'Support']);
    project = reloaded;
  });

  it('rejects updating a task when due date is before the start date', async () => {
    const { statusCode, task } = await createTask(project!.id);
    expect(statusCode).toBe(201);
    createdTaskIds.push(task.taskId);

    const response = await updateTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id, taskId: task.taskId },
        body: JSON.stringify({
          startDate: '2035-07-10',
          dueDate: '2035-07-01',
        }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors?: string[] }>(response.body).errors).toContain(
      'dueDate must be on or after startDate',
    );
  });

  it('rejects an update to a status outside of the project set', async () => {
    const updateResponse = await updateProjectHandler(
      baseEvent({
        pathParameters: { id: project!.id },
        body: JSON.stringify({ statuses: ['PLANNING', 'READY'] }),
      }),
    );
    expect(updateResponse.statusCode).toBe(200);
    project = parseBody<ProjectRecord>(updateResponse.body);

    const { statusCode, task } = await createTask(project.id, {
      name: 'Initial task',
      status: 'PLANNING',
    });
    expect(statusCode).toBe(201);
    createdTaskIds.push(task.taskId);

    const response = await updateTaskHandler(
      baseEvent({
        pathParameters: { projectId: project.id, taskId: task.taskId },
        body: JSON.stringify({ status: 'COMPLETE' }),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody<{ errors: string[] }>(response.body).errors).toContain(
      'status must match one of the project statuses',
    );
  });

  it('removes a task', async () => {
    const { statusCode, task } = await createTask(project!.id);
    expect(statusCode).toBe(201);
    createdTaskIds.push(task.taskId);

    const deleteResponse = await removeTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id, taskId: task.taskId },
      }),
    );

    expect(deleteResponse.statusCode).toBe(204);

    const index = createdTaskIds.indexOf(task.taskId);
    if (index !== -1) {
      createdTaskIds.splice(index, 1);
    }

    const getAfterDelete = await getTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id, taskId: task.taskId },
      }),
    );

    expect(getAfterDelete.statusCode).toBe(404);
  });

  it('removes all project tasks when deleting the project', async () => {
    const firstTask = await createTask(project!.id, { name: 'First cascading task' });
    expect(firstTask.statusCode).toBe(201);
    createdTaskIds.push(firstTask.task.taskId);

    const secondTask = await createTask(project!.id, { name: 'Second cascading task' });
    expect(secondTask.statusCode).toBe(201);
    createdTaskIds.push(secondTask.task.taskId);

    const projectId = project!.id;

    const deleteProjectResponse = await removeProjectHandler(
      baseEvent({
        pathParameters: { id: projectId },
      }),
    );

    expect(deleteProjectResponse.statusCode).toBe(204);

    project = undefined;
    createdTaskIds.length = 0;

    const listResponse = await listTasksHandler(
      baseEvent({
        pathParameters: { projectId },
      }),
    );

    expect(listResponse.statusCode).toBe(404);

    const getFirstTask = await getTaskHandler(
      baseEvent({
        pathParameters: { projectId, taskId: firstTask.task.taskId },
      }),
    );

    expect(getFirstTask.statusCode).toBe(404);

    const getSecondTask = await getTaskHandler(
      baseEvent({
        pathParameters: { projectId, taskId: secondTask.task.taskId },
      }),
    );

    expect(getSecondTask.statusCode).toBe(404);
  });
});
