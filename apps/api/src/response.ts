import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

const allowedOrigin =
  process.env.CORS_ALLOWED_ORIGIN && process.env.CORS_ALLOWED_ORIGIN.trim().length
    ? process.env.CORS_ALLOWED_ORIGIN.trim()
    : '*';

const allowedHeaders =
  process.env.CORS_ALLOWED_HEADERS && process.env.CORS_ALLOWED_HEADERS.trim().length
    ? process.env.CORS_ALLOWED_HEADERS.trim()
    : 'Content-Type,Authorization';

const allowedMethods =
  process.env.CORS_ALLOWED_METHODS && process.env.CORS_ALLOWED_METHODS.trim().length
    ? process.env.CORS_ALLOWED_METHODS.trim()
    : 'OPTIONS,GET,POST,PUT,DELETE';

export function json(statusCode: 204): APIGatewayProxyStructuredResultV2;
export function json<T>(statusCode: number, body: T): APIGatewayProxyStructuredResultV2;
export function json<T>(
  statusCode: number,
  body?: T,
): APIGatewayProxyStructuredResultV2 {
  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': allowedMethods,
  };

  if (statusCode === 204) {
    return {
      statusCode,
      headers: baseHeaders,
    };
  }

  if (typeof body === 'undefined') {
    throw new Error('Response body is required for non-204 responses');
  }

  return {
    statusCode,
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}
