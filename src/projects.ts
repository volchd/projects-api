import { randomUUID } from 'node:crypto';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type NativeAttributeValue,
} from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { resolveUserId } from './auth';
import { ddbDocClient } from './dynamodb';
import {
  GSI1_NAME,
  PROJECT_ENTITY_TYPE,
  PROJECT_SORT_KEY,
  TASK_KEY_PREFIX,
  isTaskSortKey,
  projectGsiPk,
  projectGsiSk,
  projectPk,
  projectSk,
} from './model';
import { json } from './response';
import type {
  CreateProjectPayload,
  ParsedBodyResult,
  Project,
  UpdateProjectPayload,
  ValidationResult,
  ProjectStatus,
} from './projects.types';
import { DEFAULT_PROJECT_STATUSES } from './projects.types';

const TABLE_NAME = (() => {
  const value = process.env.TABLE_NAME;
  if (!value) {
    throw new Error('TABLE_NAME environment variable is required');
  }
  return value;
})();

const toStringOrNull = (value: unknown): string | null | undefined => {
  if (value == null) {
    return value === null ? null : undefined;
  }
  return typeof value === 'string' ? value : undefined;
};

const isProjectStatus = (status: unknown): status is ProjectStatus =>
  typeof status === 'string' && (DEFAULT_PROJECT_STATUSES as readonly string[]).includes(status);

const toStatuses = (value: unknown): ProjectStatus[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_PROJECT_STATUSES];
  }

  const statuses = value.filter(isProjectStatus);

  return statuses.length ? [...statuses] : [...DEFAULT_PROJECT_STATUSES];
};

function parseCreatePayload(payload: unknown): ValidationResult<CreateProjectPayload> {
  const errors: string[] = [];

  if (payload == null || typeof payload !== 'object') {
    errors.push('Missing JSON body');
    return { errors };
  }

  const data = payload as Record<string, unknown>;
  const name = data.name;
  const description = toStringOrNull(data.description);

  if (typeof name !== 'string') {
    errors.push('name (string) is required');
  }

  if ('description' in data && description === undefined) {
    errors.push('description must be a string if provided');
  }

  if (errors.length) {
    return { errors };
  }

  return {
    value: {
      name: name as string,
      description,
    },
    errors,
  };
}

function parseUpdatePayload(payload: unknown): ValidationResult<UpdateProjectPayload> {
  const errors: string[] = [];

  if (payload == null || typeof payload !== 'object') {
    errors.push('Missing JSON body');
    return { errors };
  }

  const data = payload as Record<string, unknown>;
  const result: UpdateProjectPayload = {};

  if ('name' in data && data.name != null) {
    if (typeof data.name === 'string') {
      result.name = data.name;
    } else {
      errors.push('name must be a string if provided');
    }
  }

  if ('description' in data) {
    if (data.description === null || typeof data.description === 'string') {
      result.description = data.description;
    } else {
      errors.push('description must be a string or null if provided');
    }
  }

  if (errors.length) {
    return { errors };
  }

  return { value: result, errors };
}

const parseBody = (event: APIGatewayProxyEventV2): ParsedBodyResult => {
  if (!event.body) {
    return {};
  }

  try {
    return { value: JSON.parse(event.body) };
  } catch {
    return { error: 'Invalid JSON body' };
  }
};

const handleError = (error: unknown): APIGatewayProxyStructuredResultV2 => {
  const requestId = randomUUID();
  console.error(`[${requestId}]`, error);

  return json(500, {
    message: 'Internal server error',
    requestId,
  });
};

const toProject = (item: Record<string, unknown> | undefined): Project | undefined => {
  if (!item) {
    return undefined;
  }

  if (item.SK !== PROJECT_SORT_KEY) {
    return undefined;
  }

  return {
    id: String(item.projectId ?? item.id),
    userId: String(item.userId),
    name: String(item.name),
    description: (item.description ?? null) as string | null,
    statuses: toStatuses(item.statuses),
  };
};

const loadProject = async (id: string): Promise<Record<string, unknown> | undefined> => {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: projectPk(id), SK: projectSk() },
    }),
  );

  return res.Item as Record<string, unknown> | undefined;
};

export const create = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { value: body, error: bodyError } = parseBody(event);
    if (bodyError) {
      return json(400, { errors: [bodyError] });
    }

    const { value, errors } = parseCreatePayload(body);
    if (!value || errors.length) {
      return json(400, { errors });
    }

    const userId = resolveUserId(event);
    const projectId = randomUUID();

    const item = {
      PK: projectPk(projectId),
      SK: projectSk(),
      projectId,
      id: projectId,
      userId,
      name: value.name,
      description: value.description ?? null,
      entityType: PROJECT_ENTITY_TYPE,
      GSI1PK: projectGsiPk(userId),
      GSI1SK: projectGsiSk(projectId),
      statuses: [...DEFAULT_PROJECT_STATUSES],
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );

    return json(201, toProject(item)!);
  } catch (error) {
    return handleError(error);
  }
};

export const get = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return json(400, { message: 'id path parameter is required' });
    }

    const item = await loadProject(id);
    const project = toProject(item);
    if (!project) {
      return json(404, { message: 'Not found' });
    }

    return json(200, project);
  } catch (error) {
    return handleError(error);
  }
};

export const listByUser = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const userId = resolveUserId(event);

    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI1_NAME,
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': projectGsiPk(userId) },
      }),
    );

    const projects = (res.Items ?? [])
      .map((item) => toProject(item as Record<string, unknown>))
      .filter((project): project is Project => Boolean(project));

    return json(200, { items: projects });
  } catch (error) {
    return handleError(error);
  }
};

export const update = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return json(400, { message: 'id path parameter is required' });
    }

    const { value: body, error: bodyError } = parseBody(event);
    if (bodyError) {
      return json(400, { errors: [bodyError] });
    }

    const { value, errors } = parseUpdatePayload(body);
    if (!value || errors.length) {
      return json(400, { errors });
    }

    const names: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, NativeAttributeValue> = {};

    if (value.name !== undefined) {
      names.push('#n = :name');
      exprNames['#n'] = 'name';
      exprValues[':name'] = value.name;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'description')) {
      const description = value.description ?? null;
      names.push('#d = :desc');
      exprNames['#d'] = 'description';
      exprValues[':desc'] = description;
    }

    if (names.length === 0) {
      return json(400, { message: 'Nothing to update' });
    }

    const res = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: projectPk(id), SK: projectSk() },
        UpdateExpression: `SET ${names.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    const project = toProject(res.Attributes as Record<string, unknown> | undefined);
    if (!project) {
      return json(404, { message: 'Not found' });
    }

    return json(200, project);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error) {
      const errName = String((error as { name?: unknown }).name);
      if (errName === 'ConditionalCheckFailedException') {
        return json(404, { message: 'Not found' });
      }
    }
    return handleError(error);
  }
};

export const remove = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return json(400, { message: 'id path parameter is required' });
    }

    const pk = projectPk(id);
    const projectItem = await loadProject(id);
    if (!projectItem) {
      return json(404, { message: 'Not found' });
    }

    const taskRes = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :taskPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':taskPrefix': TASK_KEY_PREFIX,
        },
      }),
    );

    const taskDeletes = (taskRes.Items ?? [])
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .filter((item) => isTaskSortKey(item.SK))
      .map((item) =>
        ddbDocClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: String(item.SK) },
          }),
        ),
      );

    if (taskDeletes.length) {
      await Promise.all(taskDeletes);
    }

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: projectSk() },
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );

    return json(204);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error) {
      const errName = String((error as { name?: unknown }).name);
      if (errName === 'ConditionalCheckFailedException') {
        return json(404, { message: 'Not found' });
      }
    }
    return handleError(error);
  }
};
