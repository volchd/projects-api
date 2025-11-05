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
  ProjectLabel,
} from './projects.types';
import { DEFAULT_PROJECT_STATUSES, MAX_PROJECT_STATUS_LENGTH } from './projects.types';

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

const normalizeStatus = (status: unknown): ProjectStatus | null => {
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

const ensureStatuses = (value: unknown): ProjectStatus[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_PROJECT_STATUSES];
  }

  const seen = new Set<string>();
  const statuses: ProjectStatus[] = [];

  for (const candidate of value) {
    const normalized = normalizeStatus(candidate);
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

const MAX_PROJECT_LABEL_LENGTH = 40;

const normalizeLabel = (label: unknown): ProjectLabel | null => {
  if (typeof label !== 'string') {
    return null;
  }

  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }

  const collapsed = trimmed.replace(/\s+/g, ' ');
  if (collapsed.length > MAX_PROJECT_LABEL_LENGTH) {
    return null;
  }

  return collapsed;
};

const ensureLabels = (value: unknown): ProjectLabel[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const labels: ProjectLabel[] = [];

  for (const candidate of value) {
    const normalized = normalizeLabel(candidate);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    labels.push(normalized);
  }

  labels.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return labels;
};

const parseLabelsInput = (value: unknown, errors: string[]): ProjectLabel[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    errors.push('labels must be an array of non-empty strings if provided');
    return undefined;
  }

  const seen = new Set<string>();
  const labels: ProjectLabel[] = [];
  let hasInvalid = false;
  let hasDuplicate = false;

  for (const item of value) {
    const normalized = normalizeLabel(item);
    if (!normalized) {
      hasInvalid = true;
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      hasDuplicate = true;
      continue;
    }
    seen.add(key);
    labels.push(normalized);
  }

  if (hasInvalid) {
    errors.push(`labels must contain non-empty strings up to ${MAX_PROJECT_LABEL_LENGTH} characters`);
  }

  if (hasDuplicate) {
    errors.push('labels must contain unique values');
  }

  labels.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return labels;
};

const parseStatusesInput = (value: unknown, errors: string[]): ProjectStatus[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    errors.push('statuses must be an array of non-empty strings if provided');
    return undefined;
  }

  const statuses: ProjectStatus[] = [];
  const seen = new Set<string>();
  let hasInvalid = false;
  let hasDuplicate = false;

  for (const item of value) {
    const normalized = normalizeStatus(item);
    if (!normalized) {
      hasInvalid = true;
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      hasDuplicate = true;
      continue;
    }
    seen.add(key);
    statuses.push(normalized);
  }

  if (hasInvalid) {
    errors.push(`statuses must contain non-empty strings up to ${MAX_PROJECT_STATUS_LENGTH} characters`);
  }

  if (hasDuplicate) {
    errors.push('statuses must contain unique values');
  }

  if (!statuses.length) {
    errors.push('statuses must include at least one value');
    return undefined;
  }

  return statuses;
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
  let statuses: ProjectStatus[] | undefined;
  let labels: ProjectLabel[] | undefined;

  if (typeof name !== 'string') {
    errors.push('name (string) is required');
  }

  if ('description' in data && description === undefined) {
    errors.push('description must be a string if provided');
  }

  if ('statuses' in data) {
    statuses = parseStatusesInput(data.statuses, errors);
  }

  if ('labels' in data) {
    labels = parseLabelsInput(data.labels, errors);
  }

  if (errors.length) {
    return { errors };
  }

  return {
    value: {
      name: name as string,
      description,
      statuses,
      labels,
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

  if ('statuses' in data) {
    const parsedStatuses = parseStatusesInput(data.statuses, errors);
    if (parsedStatuses) {
      result.statuses = parsedStatuses;
    }
  }

  if ('labels' in data) {
    const parsedLabels = parseLabelsInput(data.labels, errors);
    if (parsedLabels !== undefined) {
      result.labels = parsedLabels;
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
    statuses: ensureStatuses(item.statuses),
    labels: ensureLabels(item.labels),
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

const deleteProjectTasks = async (pk: string): Promise<void> => {
  let exclusiveStartKey: Record<string, NativeAttributeValue> | undefined;

  do {
    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :taskPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':taskPrefix': TASK_KEY_PREFIX,
        },
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    );

    const taskDeletes = (res.Items ?? [])
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

    const lastEvaluatedKey = res.LastEvaluatedKey as Record<string, NativeAttributeValue> | undefined;
    exclusiveStartKey = lastEvaluatedKey && Object.keys(lastEvaluatedKey).length ? lastEvaluatedKey : undefined;
  } while (exclusiveStartKey);
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
    const statuses = value.statuses ?? [...DEFAULT_PROJECT_STATUSES];
    const labels = value.labels ?? [];
    const now = new Date().toISOString();

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
      statuses,
      labels,
      createdAt: now,
      updatedAt: now,
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

    if (value.statuses !== undefined) {
      names.push('#s = :statuses');
      exprNames['#s'] = 'statuses';
      exprValues[':statuses'] = value.statuses;
    }

    if (value.labels !== undefined) {
      names.push('#l = :labels');
      exprNames['#l'] = 'labels';
      exprValues[':labels'] = value.labels;
    }

    if (names.length === 0) {
      return json(400, { message: 'Nothing to update' });
    }

    names.push('#updatedAt = :updatedAt');
    exprNames['#updatedAt'] = 'updatedAt';
    exprValues[':updatedAt'] = new Date().toISOString();

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

    await deleteProjectTasks(pk);

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
