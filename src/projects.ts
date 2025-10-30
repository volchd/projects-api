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
import { ddbDocClient } from './dynamodb';
import { json } from './response';

const TABLE_NAME = process.env.TABLE_NAME as string;
const USER_INDEX = 'UserIndex';

interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
}

interface CreateProjectPayload {
  userId: string;
  name: string;
  description?: string | null;
}

interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
}

interface ValidationResult<T> {
  value?: T;
  errors: string[];
}

const toStringOrNull = (value: unknown): string | null | undefined => {
  if (value == null) {
    return value === null ? null : undefined;
  }
  return typeof value === 'string' ? value : undefined;
};

function parseCreatePayload(payload: unknown): ValidationResult<CreateProjectPayload> {
  const errors: string[] = [];

  if (payload == null || typeof payload !== 'object') {
    errors.push('Missing JSON body');
    return { errors };
  }

  const data = payload as Record<string, unknown>;
  const userId = data.userId;
  const name = data.name;
  const description = toStringOrNull(data.description);

  if (typeof userId !== 'string') {
    errors.push('userId (string) is required');
  }

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
      userId: userId as string,
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

  if ('description' in data && data.description != null) {
    if (typeof data.description === 'string') {
      result.description = data.description;
    } else {
      errors.push('description must be a string if provided');
    }
  }

  if (errors.length) {
    return { errors };
  }

  return { value: result, errors };
}

const parseBody = (event: APIGatewayProxyEventV2): unknown =>
  event.body ? JSON.parse(event.body) : undefined;

const handleError = (error: unknown): APIGatewayProxyStructuredResultV2 => {
  const hasMessage = typeof error === 'object' && error !== null && 'message' in error;
  const message = hasMessage ? (error as { message?: unknown }).message : undefined;

  console.error(error);

  if (hasMessage && message != null) {
    return json(500, {
      message: 'Internal server error',
      error: typeof message === 'string' ? message : String(message),
    });
  }

  return json(500, { message: 'Internal server error' });
};

export const create = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { value, errors } = parseCreatePayload(parseBody(event));
    if (!value || errors.length) {
      return json(400, { errors });
    }

    const item: Project = {
      id: randomUUID(),
      userId: value.userId,
      name: value.name,
      description: value.description ?? null,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );

    return json(201, item);
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

    const res = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      }),
    );

    if (!res.Item) {
      return json(404, { message: 'Not found' });
    }

    return json(200, res.Item);
  } catch (error) {
    return handleError(error);
  }
};

export const listByUser = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return json(400, { message: 'userId path parameter is required' });
    }

    console.log('[listByUser] Querying projects', {
      table: TABLE_NAME,
      index: USER_INDEX,
      userId,
      envRegion: process.env.AWS_REGION,
      offline: process.env.IS_OFFLINE,
      endpoint: process.env.DYNAMODB_ENDPOINT,
    });

    const res = await ddbDocClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: USER_INDEX,
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
      }),
    );

    return json(200, { items: res.Items ?? [] });
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

    const { value, errors } = parseUpdatePayload(parseBody(event));
    if (!value || errors.length) {
      return json(400, { errors });
    }

    const names: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, NativeAttributeValue> = {};

    if (value.name != null) {
      names.push('#n = :name');
      exprNames['#n'] = 'name';
      exprValues[':name'] = value.name;
    }

    if (value.description != null) {
      names.push('#d = :desc');
      exprNames['#d'] = 'description';
      exprValues[':desc'] = value.description;
    }

    if (names.length === 0) {
      return json(400, { message: 'Nothing to update' });
    }

    const res = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: `SET ${names.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(id)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    return json(200, res.Attributes);
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

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
        ConditionExpression: 'attribute_exists(id)',
      }),
    );

    return json(204, {});
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
