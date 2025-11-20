import { randomUUID } from 'node:crypto';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { resolveUser, UnauthorizedError } from './auth';
import { env } from './config/env';
import { ddbDocClient } from './dynamodb';
import {
  USER_PROFILE_ENTITY_TYPE,
  userPk,
  userProfileSk,
} from './model';
import { json } from './response';
import type {
  ParsedBodyResult,
  UpsertUserProfilePayload,
  UserProfile,
  ValidationResult,
} from './users.types';
import { MAX_NAME_LENGTH } from './users.types';

const TABLE_NAME = env.tableName;

type AuthResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: APIGatewayProxyStructuredResultV2 };

const extractEmailFromClaims = (claims: Record<string, unknown>): string | null => {
  const email = claims.email;
  if (typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim();
  return trimmed.length ? trimmed : null;
};

const authenticateRequest = async (
  event: APIGatewayProxyEventV2,
): Promise<AuthResult> => {
  try {
    const { userId, claims } = await resolveUser(event);
    const email = extractEmailFromClaims(claims);
    return { ok: true, userId, email };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, response: json(401, { message: 'Unauthorized' }) };
    }
    throw error;
  }
};

const normalizeName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed.length || trimmed.length > MAX_NAME_LENGTH) {
    return null;
  }

  return trimmed;
};

const parseUpsertPayload = (
  data: unknown,
): ValidationResult<UpsertUserProfilePayload> => {
  const errors: string[] = [];
  const result: Partial<UpsertUserProfilePayload> = {};

  if (!data || typeof data !== 'object') {
    return { errors: ['Request body must be a JSON object'] };
  }

  const firstName = normalizeName((data as Record<string, unknown>).firstName);
  if (!firstName) {
    errors.push(`firstName (string) is required and must be <= ${MAX_NAME_LENGTH} characters`);
  } else {
    result.firstName = firstName;
  }

  const lastName = normalizeName((data as Record<string, unknown>).lastName);
  if (!lastName) {
    errors.push(`lastName (string) is required and must be <= ${MAX_NAME_LENGTH} characters`);
  } else {
    result.lastName = lastName;
  }

  if (errors.length) {
    return { errors };
  }

  return { value: result as UpsertUserProfilePayload, errors };
};

const parseBody = (event: APIGatewayProxyEventV2): ParsedBodyResult => {
  if (!event.body) {
    return { error: 'Missing JSON body' };
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

const toUserProfile = (
  item: Record<string, unknown> | undefined,
): UserProfile | undefined => {
  if (!item) {
    return undefined;
  }

  if (item.SK !== userProfileSk()) {
    return undefined;
  }

  return {
    userId: String(item.userId),
    email: item.email == null ? null : String(item.email),
    firstName: String(item.firstName),
    lastName: String(item.lastName),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  };
};

const loadProfile = async (
  userId: string,
): Promise<Record<string, unknown> | undefined> => {
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: userProfileSk() },
    }),
  );

  return res.Item as Record<string, unknown> | undefined;
};

export const getProfile = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const auth = await authenticateRequest(event);
    if (!auth.ok) {
      return auth.response;
    }

    const item = await loadProfile(auth.userId);
    const profile = toUserProfile(item);
    if (!profile) {
      return json(404, { message: 'Profile not found' });
    }

    return json(200, profile);
  } catch (error) {
    return handleError(error);
  }
};

export const putProfile = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { value: body, error: bodyError } = parseBody(event);
    if (bodyError) {
      return json(400, { errors: [bodyError] });
    }

    const { value, errors } = parseUpsertPayload(body);
    if (!value || errors.length) {
      return json(400, { errors });
    }

    const auth = await authenticateRequest(event);
    if (!auth.ok) {
      return auth.response;
    }

    const now = new Date().toISOString();

    const res = await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: userPk(auth.userId), SK: userProfileSk() },
        UpdateExpression:
          'SET #entityType = :entityType, #userId = :userId, email = :email, firstName = :firstName, lastName = :lastName, updatedAt = :updatedAt, createdAt = if_not_exists(createdAt, :createdAt)',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
          '#userId': 'userId',
        },
        ExpressionAttributeValues: {
          ':entityType': USER_PROFILE_ENTITY_TYPE,
          ':userId': auth.userId,
          ':email': auth.email ?? null,
          ':firstName': value.firstName,
          ':lastName': value.lastName,
          ':updatedAt': now,
          ':createdAt': now,
        },
        ReturnValues: 'ALL_NEW',
      }),
    );

    const updated = toUserProfile(res.Attributes as Record<string, unknown> | undefined);
    return json(200, updated ?? { userId: auth.userId, ...value, email: auth.email ?? null, createdAt: now, updatedAt: now });
  } catch (error) {
    return handleError(error);
  }
};
