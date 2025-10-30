import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export function json<T>(statusCode: number, body: T): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
