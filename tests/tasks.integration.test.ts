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
  remove as removeProjectHandler,
} from '../src/projects';
import {
  create as createTaskHandler,
  get as getTaskHandler,
  listByProject as listTasksHandler,
  remove as removeTaskHandler,
  update as updateTaskHandler,
} from '../src/tasks';

vi.hoisted(() => {
  process.env.IS_OFFLINE = 'true';
  process.env.AWS_REGION = 'us-east-1';
  process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:8000';
  process.env.TABLE_NAME = `TasksTableTest-${Date.now()}`;
});

const tableName = process.env.TABLE_NAME as string;
let dynamoAvailable = true;

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
}

interface TaskRecord {
  projectId: string;
  taskId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
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
      dynamoAvailable = false;
      console.warn(
        `Skipping tasks integration tests: unable to reach DynamoDB Local at ${process.env.DYNAMODB_ENDPOINT}.`,
      );
      console.warn(error);
      return;
    }

    if (!dynamoAvailable) {
      return;
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

    await waitUntilTableExists(
      { client: dynamoClient, maxWaitTime: 20, minDelay: 1 },
      { TableName: tableName },
    );
  });

  afterAll(async () => {
    if (!dynamoAvailable) {
      return;
    }

    await dynamoClient.send(
      new DeleteTableCommand({
        TableName: tableName,
      }),
    );
  });

  beforeEach(async () => {
    if (!dynamoAvailable) {
      return;
    }

    const { statusCode, project: created } = await createProject();
    expect(statusCode).toBe(201);
    expect(created.userId).toBe(hardcodedUserId);
    project = created;
  });

  afterEach(async () => {
    if (!dynamoAvailable) {
      project = undefined;
      createdTaskIds.length = 0;
      return;
    }

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
  });

  it('creates a task for a project', async () => {
    if (!dynamoAvailable) {
      return;
    }

    const { statusCode, task } = await createTask(project!.id);

    expect(statusCode).toBe(201);
    expect(task.projectId).toBe(project!.id);
    expect(task.name).toBe('Integration Task');
    expect(task.description).toBe('Created via integration test');
    expect(typeof task.taskId).toBe('string');
    expect(typeof task.createdAt).toBe('string');
    expect(typeof task.updatedAt).toBe('string');

    createdTaskIds.push(task.taskId);
  });

  it('retrieves a task by id', async () => {
    if (!dynamoAvailable) {
      return;
    }

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
    if (!dynamoAvailable) {
      return;
    }

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
          item.description === 'First',
      ),
    ).toBe(true);

    expect(
      items.some(
        (item) =>
          item.projectId === project!.id &&
          item.taskId === secondTask.task.taskId &&
          item.name === 'Second task' &&
          item.description === null,
      ),
    ).toBe(true);
  });

  it('updates a task', async () => {
    if (!dynamoAvailable) {
      return;
    }

    const { statusCode, task } = await createTask(project!.id);
    expect(statusCode).toBe(201);
    createdTaskIds.push(task.taskId);

    const response = await updateTaskHandler(
      baseEvent({
        pathParameters: { projectId: project!.id, taskId: task.taskId },
        body: JSON.stringify({
          name: 'Updated task name',
          description: 'Updated description',
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
    });
    expect(typeof updated.createdAt).toBe('string');
    expect(typeof updated.updatedAt).toBe('string');
  });

  it('removes a task', async () => {
    if (!dynamoAvailable) {
      return;
    }

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
});
