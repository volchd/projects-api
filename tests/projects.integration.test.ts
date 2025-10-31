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
import { create, get, listByUser, remove, update } from '../src/projects';
import { resolveUserId } from '../src/auth';
import { ddbDocClient } from '../src/dynamodb';

vi.hoisted(() => {
  process.env.IS_OFFLINE = 'true';
  process.env.AWS_REGION = 'us-east-1';
  process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:8000';
  process.env.TABLE_NAME = `ProjectsTableTest-${Date.now()}`;
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

interface ProjectAttributes {
  userId: string;
  name: string;
  description: string | null;
}

interface ProjectRecord extends ProjectAttributes {
  id: string;
}

interface ProjectListResponse {
  items: ProjectRecord[];
}

const createProject = async (
  input: Partial<Omit<ProjectAttributes, 'userId'>> = {},
): Promise<{ statusCode: number; project: ProjectRecord }> => {
  const response = await create(
    baseEvent({
      body: JSON.stringify({
        name: 'Integration Project',
        description: 'Created via integration test',
        ...input,
      }),
    }),
  );

  return {
    statusCode: response.statusCode,
    project: parseBody<ProjectRecord>(response.body),
  };
};

describe('projects integration', () => {
  const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
  });

  beforeAll(async () => {
    try {
      await dynamoClient.send(new ListTablesCommand({ Limit: 1 }));
    } catch (error) {
      dynamoAvailable = false;
      console.warn(
        `Skipping integration tests: unable to reach DynamoDB Local at ${process.env.DYNAMODB_ENDPOINT}.`,
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
      { client: dynamoClient, maxWaitTime: 30 },
      { TableName: tableName },
    );
  });

  afterAll(async () => {
    if (!dynamoAvailable) {
      dynamoClient.destroy();
      ddbDocClient.destroy?.();
      return;
    }

    await dynamoClient.send(new DeleteTableCommand({ TableName: tableName }));
    dynamoClient.destroy();
    ddbDocClient.destroy?.();
  });

  it('creates a project with DynamoDB Local', async () => {
    if (!dynamoAvailable) {
      return;
    }

    const { statusCode, project } = await createProject();

    expect(statusCode).toBe(201);
    expect(project).toMatchObject<ProjectAttributes>({
      userId: hardcodedUserId,
      name: 'Integration Project',
      description: 'Created via integration test',
    });

    const deleteResponse = await remove(
      baseEvent({
        pathParameters: { id: project.id },
      }),
    );

    expect(deleteResponse.statusCode).toBe(204);
  });

  describe('with an existing project', () => {
    let project: ProjectRecord | undefined;

    beforeEach(async () => {
      if (!dynamoAvailable) {
        return;
      }

      const { statusCode, project: created } = await createProject({
        name: 'Existing Project',
      });

      expect(statusCode).toBe(201);
      project = created;
    });

    afterEach(async () => {
      if (!dynamoAvailable) {
        project = undefined;
        return;
      }

      if (!project) {
        return;
      }

      const response = await remove(
        baseEvent({
          pathParameters: { id: project.id },
        }),
      );

      if (![204, 404].includes(response.statusCode ?? 0)) {
        throw new Error(
          `Failed to clean up project ${project.id}: ${response.statusCode} ${response.body}`,
        );
      }

      project = undefined;
    });

    it('retrieves a project by id', async () => {
      if (!dynamoAvailable) {
        return;
      }

      const getResponse = await get(
        baseEvent({
          pathParameters: { id: project!.id },
        }),
      );

      expect(getResponse.statusCode).toBe(200);
      expect(parseBody<ProjectRecord>(getResponse.body)).toMatchObject({
        id: project!.id,
        userId: project!.userId,
        name: 'Existing Project',
        description: project!.description,
      });
    });

    it('lists projects by user', async () => {
      if (!dynamoAvailable) {
        return;
      }

      const listResponse = await listByUser(
        baseEvent(),
      );

      expect(listResponse.statusCode).toBe(200);
      const items = parseBody<ProjectListResponse>(listResponse.body).items ?? [];

      expect(
        items.some(
          (item) =>
            item.userId === project!.userId &&
            item.name === project!.name &&
            item.description === project!.description,
        ),
      ).toBe(true);
    });

    it('updates project fields', async () => {
      if (!dynamoAvailable) {
        return;
      }

      const updateResponse = await update(
        baseEvent({
          pathParameters: { id: project!.id },
          body: JSON.stringify({ description: 'Updated description' }),
        }),
      );

      expect(updateResponse.statusCode).toBe(200);
      const updated = parseBody<ProjectRecord>(updateResponse.body);

      expect(updated).toMatchObject({
        id: project!.id,
        description: 'Updated description',
      });

      project = { ...project!, description: 'Updated description' };
    });

    it('deletes a project', async () => {
      if (!dynamoAvailable) {
        return;
      }

      const projectId = project!.id;
      const deleteResponse = await remove(
        baseEvent({
          pathParameters: { id: projectId },
        }),
      );

      expect(deleteResponse.statusCode).toBe(204);
      project = undefined;

      const getAfterDeleteResponse = await get(
        baseEvent({
          pathParameters: { id: projectId },
        }),
      );

      expect(getAfterDeleteResponse.statusCode).toBe(404);
    });
  });
});
