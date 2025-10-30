import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { create, get, listByUser, remove, update } from './projects';
import { ddbDocClient } from './dynamodb';

vi.hoisted(() => {
  process.env.IS_OFFLINE = 'true';
  process.env.AWS_REGION = 'us-east-1';
  process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:8000';
  process.env.TABLE_NAME = `ProjectsTableTest-${Date.now()}`;
});

const tableName = process.env.TABLE_NAME as string;

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

describe('projects integration', () => {
  const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
  });

  beforeAll(async () => {
    await dynamoClient.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'userId', AttributeType: 'S' },
        ],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'UserIndex',
            KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
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
    await dynamoClient.send(new DeleteTableCommand({ TableName: tableName }));
    dynamoClient.destroy();
    ddbDocClient.destroy?.();
  });

  it('executes a full project lifecycle against DynamoDB Local', async () => {
    const userId = 'integration-user';

    const createResponse = await create(
      baseEvent({
        body: JSON.stringify({
          userId,
          name: 'Integration Project',
          description: 'Created via integration test',
        }),
      }),
    );

    expect(createResponse.statusCode).toBe(201);

    const created = parseBody<{
      id: string;
      userId: string;
      name: string;
      description: string | null;
    }>(createResponse.body);

    expect(created).toMatchObject({
      userId,
      name: 'Integration Project',
      description: 'Created via integration test',
    });

    const getResponse = await get(
      baseEvent({
        pathParameters: { id: created.id },
      }),
    );

    expect(getResponse.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(getResponse.body)).toMatchObject({
      id: created.id,
      userId,
      name: created.name,
      description: created.description,
    });

    const listResponse = await listByUser(
      baseEvent({
        pathParameters: { userId },
      }),
    );

    expect(listResponse.statusCode).toBe(200);
    expect(parseBody<{ items: unknown[] }>(listResponse.body).items).toMatchObject([
      {
        id: created.id,
        userId,
        name: created.name,
        description: created.description,
      },
    ]);

    const updateResponse = await update(
      baseEvent({
        pathParameters: { id: created.id },
        body: JSON.stringify({ description: 'Updated description' }),
      }),
    );

    expect(updateResponse.statusCode).toBe(200);
    expect(parseBody<Record<string, unknown>>(updateResponse.body)).toMatchObject({
      id: created.id,
      description: 'Updated description',
    });

    const deleteResponse = await remove(
      baseEvent({
        pathParameters: { id: created.id },
      }),
    );

    expect(deleteResponse.statusCode).toBe(204);
    expect(parseBody<Record<string, never>>(deleteResponse.body)).toEqual({});

    const getAfterDeleteResponse = await get(
      baseEvent({
        pathParameters: { id: created.id },
      }),
    );

    expect(getAfterDeleteResponse.statusCode).toBe(404);
  });
});
