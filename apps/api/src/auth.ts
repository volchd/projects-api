import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export const resolveUserId = (_event: APIGatewayProxyEventV2): string => {
  return 'demo-user';
};
