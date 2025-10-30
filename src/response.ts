import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export function json(statusCode: 204): APIGatewayProxyStructuredResultV2;
export function json<T>(statusCode: number, body: T): APIGatewayProxyStructuredResultV2;
export function json<T>(
  statusCode: number,
  body?: T,
): APIGatewayProxyStructuredResultV2 {
  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
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
