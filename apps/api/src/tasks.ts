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
import type { ParsedBodyResult, ValidationResult, ProjectStatus } from './projects.types';
import { DEFAULT_PROJECT_STATUSES, MAX_PROJECT_STATUS_LENGTH } from './projects.types';
import { DEFAULT_TASK_PRIORITY, DEFAULT_TASK_STATUS, isTaskPriority } from './tasks.types';
import type {
  CreateTaskPayload,
  Task,
  TaskPriority,
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

type DateField = 'startDate' | 'dueDate';

const normalizeDateInput = (
  value: unknown,
  field: DateField,
  errors: string[],
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    errors.push(`${field} must be a valid ISO 8601 date string if provided`);
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    errors.push(`${field} must be a valid ISO 8601 date string if provided`);
    return undefined;
  }

  return new Date(timestamp).toISOString();
};

const validateDateOrder = (
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
  errors: string[],
) => {
  if (
    typeof startDate === 'string' &&
    typeof dueDate === 'string' &&
    new Date(dueDate).getTime() < new Date(startDate).getTime()
  ) {
    errors.push('dueDate must be on or after startDate');
  }
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

const normalizeTaskStatus = (status: unknown): TaskStatus | null => {
  if (typeof status !== 'string') {
    return null;
  }

  const trimmed = status.trim();
  if (!trimmed) {
    return null;
  }

  const collapsed = trimmed.replace(/\s+/g, ' ');
  if (collapsed.length > MAX_PROJECT_STATUS_LENGTH) {
    return null;
  }

  return collapsed.toUpperCase();
};

const normalizeTaskPriority = (priority: unknown): TaskPriority | null => {
  if (typeof priority !== 'string') {
    return null;
  }

  const trimmed = priority.trim();
  if (!trimmed) {
    return null;
  }

  return isTaskPriority(trimmed) ? trimmed : null;
};

const coerceProjectStatuses = (value: unknown): ProjectStatus[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_PROJECT_STATUSES];
  }

  const statuses: ProjectStatus[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    const normalized = normalizeTaskStatus(candidate);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    statuses.push(normalized);
  }

  return statuses.length ? statuses : [...DEFAULT_PROJECT_STATUSES];
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
  let status: TaskStatus | undefined;
  let priority: TaskPriority | undefined;
  const hasStartDate = Object.prototype.hasOwnProperty.call(data, 'startDate');
  const hasDueDate = Object.prototype.hasOwnProperty.call(data, 'dueDate');
  let startDate: string | null | undefined;
  let dueDate: string | null | undefined;

  if (typeof name !== 'string') {
    errors.push('name (string) is required');
  }

  if ('description' in data && description === undefined) {
    errors.push('description must be a string if provided');
  }

  if ('status' in data) {
    const normalizedStatus = normalizeTaskStatus(data.status);
    if (!normalizedStatus) {
      errors.push(`status must be a non-empty string up to ${MAX_PROJECT_STATUS_LENGTH} characters if provided`);
    } else {
      status = normalizedStatus;
    }
  }

  if ('priority' in data) {
    const normalizedPriority = normalizeTaskPriority(data.priority);
    if (!normalizedPriority) {
      errors.push('priority must be one of None, Low, Normal, High, Urgent if provided');
    } else {
      priority = normalizedPriority;
    }
  }

  if (hasStartDate) {
    startDate = normalizeDateInput(data.startDate, 'startDate', errors);
  }

  if (hasDueDate) {
    dueDate = normalizeDateInput(data.dueDate, 'dueDate', errors);
  }

  if (!errors.length) {
    validateDateOrder(startDate, dueDate, errors);
  }

  if (errors.length) {
    return { errors };
  }

  const result: CreateTaskPayload = {
    name: name as string,
    description,
    status,
    priority,
  };

  if (hasStartDate) {
    result.startDate = startDate ?? null;
  }

  if (hasDueDate) {
    result.dueDate = dueDate ?? null;
  }

  return {
    value: result,
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
  const hasStartDate = Object.prototype.hasOwnProperty.call(data, 'startDate');
  const hasDueDate = Object.prototype.hasOwnProperty.call(data, 'dueDate');

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

  if ('status' in data) {
    const normalizedStatus = normalizeTaskStatus(data.status);
    if (normalizedStatus) {
      result.status = normalizedStatus;
    } else {
      errors.push(`status must be a non-empty string up to ${MAX_PROJECT_STATUS_LENGTH} characters if provided`);
    }
  }

  if ('priority' in data) {
    const normalizedPriority = normalizeTaskPriority(data.priority);
    if (normalizedPriority) {
      result.priority = normalizedPriority;
    } else {
      errors.push('priority must be one of None, Low, Normal, High, Urgent if provided');
    }
  }

  if (hasStartDate) {
    const normalizedStart = normalizeDateInput(data.startDate, 'startDate', errors);
    if (normalizedStart !== undefined) {
      result.startDate = normalizedStart;
    }
  }

  if (hasDueDate) {
    const normalizedDue = normalizeDateInput(data.dueDate, 'dueDate', errors);
    if (normalizedDue !== undefined) {
      result.dueDate = normalizedDue;
    }
  }

  if (!errors.length) {
    validateDateOrder(result.startDate, result.dueDate, errors);
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
): Promise<ProjectStatus[] | null> => {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: projectPk(projectId), SK: projectSk() },
    }),
  );

  const item = res.Item as Record<string, unknown> | undefined;
  if (!item || item.SK !== PROJECT_SORT_KEY) {
    return null;
  }

  if (String(item.userId) !== userId) {
    return null;
  }

  return coerceProjectStatuses(item.statuses);
};

const toTaskStatus = (status: unknown): TaskStatus => {
  if (typeof status === 'string' && status.trim()) {
    return status;
  }
  return DEFAULT_TASK_STATUS;
};

const toTaskPriority = (priority: unknown): TaskPriority => {
  if (typeof priority === 'string') {
    const trimmed = priority.trim();
    if (isTaskPriority(trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_TASK_PRIORITY;
};

const toDateValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
};

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
    priority: toTaskPriority(item.priority),
    startDate: toDateValue(item.startDate),
    dueDate: toDateValue(item.dueDate),
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
    const projectStatuses = await loadProjectForUser(projectId, userId);
    if (!projectStatuses) {
      return json(404, { message: 'Project not found' });
    }

    const fallbackStatus = projectStatuses[0] ?? DEFAULT_TASK_STATUS;
    const targetStatus = value.status ?? fallbackStatus;
    const priority = value.priority ?? DEFAULT_TASK_PRIORITY;
    const startDate = value.startDate ?? null;
    const dueDate = value.dueDate ?? null;

    if (!projectStatuses.includes(targetStatus)) {
      return json(400, {
        errors: ['status must match one of the project statuses'],
      });
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
      status: targetStatus,
      priority,
      startDate,
      dueDate,
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
    const projectStatuses = await loadProjectForUser(projectId, userId);
    if (!projectStatuses) {
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

    const userId = resolveUserId(event);
    const projectStatuses = await loadProjectForUser(projectId, userId);
    if (!projectStatuses) {
      return json(404, { message: 'Project not found' });
    }

    if (Object.prototype.hasOwnProperty.call(value, 'status') && value.status) {
      if (!projectStatuses.includes(value.status)) {
        return json(400, {
          errors: ['status must match one of the project statuses'],
        });
      }
    }

    const names: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, NativeAttributeValue> = {
      ':user': userId,
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

    if (Object.prototype.hasOwnProperty.call(value, 'status') && value.status) {
      names.push('#s = :status');
      exprNames['#s'] = 'status';
      exprValues[':status'] = value.status;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'priority')) {
      names.push('#p = :priority');
      exprNames['#p'] = 'priority';
      exprValues[':priority'] = value.priority ?? DEFAULT_TASK_PRIORITY;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'startDate')) {
      names.push('#sd = :startDate');
      exprNames['#sd'] = 'startDate';
      exprValues[':startDate'] = value.startDate ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'dueDate')) {
      names.push('#dd = :dueDate');
      exprNames['#dd'] = 'dueDate';
      exprValues[':dueDate'] = value.dueDate ?? null;
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
