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
  PROJECT_SORT_KEY,
  TASK_ENTITY_TYPE,
  TASK_KEY_PREFIX,
  isTaskSortKey,
  projectPk,
  projectSk,
  taskSk,
} from './model';
import { json } from './response';
import type { ParsedBodyResult, ValidationResult } from './projects.types';
import {
  DEFAULT_TASK_STATUS,
  isTaskStatus,
} from './tasks.types';
import type {
  CreateTaskPayload,
  Task,
  TaskStatus,
  UpdateTaskPayload,
} from './tasks.types';

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

function parseCreatePayload(payload: unknown): ValidationResult<CreateTaskPayload> {
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

function parseUpdatePayload(payload: unknown): ValidationResult<UpdateTaskPayload> {
  const errors: string[] = [];

  if (payload == null || typeof payload !== 'object') {
    errors.push('Missing JSON body');
    return { errors };
  }

  const data = payload as Record<string, unknown>;
  const result: UpdateTaskPayload = {};

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

const handleError = (error: unknown): APIGatewayProxyStructuredResultV2 => {
  const requestId = randomUUID();
  console.error(`[${requestId}]`, error);

  return json(500, {
    message: 'Internal server error',
    requestId,
  });
};

const loadProjectForUser = async (
  projectId: string,
  userId: string,
): Promise<boolean> => {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: projectPk(projectId), SK: projectSk() },
    }),
  );

  const item = res.Item as Record<string, unknown> | undefined;
  if (!item || item.SK !== PROJECT_SORT_KEY) {
    return false;
  }

  return String(item.userId) === userId;
};

const toTaskStatus = (status: unknown): TaskStatus =>
  isTaskStatus(status) ? status : DEFAULT_TASK_STATUS;

const toTask = (item: Record<string, unknown> | undefined): Task | undefined => {
  if (!item) {
    return undefined;
  }

  if (!isTaskSortKey(item.SK)) {
    return undefined;
  }

  return {
    projectId: String(item.projectId),
    taskId: String(item.taskId),
    name: String(item.name),
    description: (item.description ?? null) as string | null,
    status: toTaskStatus(item.status),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  };
};

export const create = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return json(400, { message: 'projectId path parameter is required' });
    }

    const { value: body, error: bodyError } = parseBody(event);
    if (bodyError) {
      return json(400, { errors: [bodyError] });
    }

    const { value, errors } = parseCreatePayload(body);
    if (!value || errors.length) {
      return json(400, { errors });
    }

    const userId = resolveUserId(event);
    const projectExistsForUser = await loadProjectForUser(projectId, userId);
    if (!projectExistsForUser) {
      return json(404, { message: 'Project not found' });
    }

    const now = new Date().toISOString();
    const taskId = randomUUID();

    const item = {
      PK: projectPk(projectId),
      SK: taskSk(taskId),
      projectId,
      taskId,
      userId,
      name: value.name,
      description: value.description ?? null,
      status: DEFAULT_TASK_STATUS,
      createdAt: now,
      updatedAt: now,
      entityType: TASK_ENTITY_TYPE,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );

    return json(201, toTask(item)!);
  } catch (error) {
    return handleError(error);
  }
};

export const get = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const projectId = event.pathParameters?.projectId;
    const taskId = event.pathParameters?.taskId;
    if (!projectId) {
      return json(400, { message: 'projectId path parameter is required' });
    }
    if (!taskId) {
      return json(400, { message: 'taskId path parameter is required' });
    }

    const userId = resolveUserId(event);

    const res = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: projectPk(projectId), SK: taskSk(taskId) },
      }),
    );

    const item = res.Item as Record<string, unknown> | undefined;
    if (!item || !isTaskSortKey(item.SK) || item.userId !== userId) {
      return json(404, { message: 'Not found' });
    }

    const task = toTask(item);
    if (!task) {
      return json(404, { message: 'Not found' });
    }

    return json(200, task);
  } catch (error) {
    return handleError(error);
  }
};

export const listByProject = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return json(400, { message: 'projectId path parameter is required' });
    }

    const userId = resolveUserId(event);
    const projectExistsForUser = await loadProjectForUser(projectId, userId);
    if (!projectExistsForUser) {
      return json(404, { message: 'Project not found' });
    }

    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :taskPrefix)',
        ExpressionAttributeValues: {
          ':pk': projectPk(projectId),
          ':taskPrefix': TASK_KEY_PREFIX,
        },
      }),
    );

    const tasks = (res.Items ?? [])
      .map((item) => toTask(item as Record<string, unknown>))
      .filter((task): task is Task => Boolean(task));

    return json(200, { items: tasks });
  } catch (error) {
    return handleError(error);
  }
};

export const update = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const projectId = event.pathParameters?.projectId;
    const taskId = event.pathParameters?.taskId;
    if (!projectId) {
      return json(400, { message: 'projectId path parameter is required' });
    }
    if (!taskId) {
      return json(400, { message: 'taskId path parameter is required' });
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
    const exprValues: Record<string, NativeAttributeValue> = {
      ':user': resolveUserId(event),
      ':updatedAt': new Date().toISOString(),
    };

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

    names.push('#u = :updatedAt');
    exprNames['#u'] = 'updatedAt';

    const res = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: projectPk(projectId), SK: taskSk(taskId) },
        UpdateExpression: `SET ${names.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(PK) AND userId = :user',
        ReturnValues: 'ALL_NEW',
      }),
    );

    const task = toTask(res.Attributes as Record<string, unknown> | undefined);
    if (!task) {
      return json(404, { message: 'Not found' });
    }

    return json(200, task);
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
    const projectId = event.pathParameters?.projectId;
    const taskId = event.pathParameters?.taskId;
    if (!projectId) {
      return json(400, { message: 'projectId path parameter is required' });
    }
    if (!taskId) {
      return json(400, { message: 'taskId path parameter is required' });
    }

    const userId = resolveUserId(event);

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: projectPk(projectId), SK: taskSk(taskId) },
        ConditionExpression: 'attribute_exists(PK) AND userId = :user',
        ExpressionAttributeValues: {
          ':user': userId,
        },
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
