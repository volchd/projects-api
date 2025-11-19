import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { env } from './config/env';

// When running serverless-offline, we want to hit the local DynamoDB in Docker.
// We'll detect this via IS_OFFLINE env var set by serverless-offline, or allow override with DYNAMODB_ENDPOINT.
const isOffline = env.isOffline;
const localEndpoint = env.dynamodbEndpoint ?? 'http://localhost:8000';
const region = env.awsRegion;

if ((env.debugNamespaces ?? '').includes('dynamodb') || isOffline) {
  console.log('[dynamodb] Initializing client', {
    region,
    isOffline,
    endpoint: isOffline ? localEndpoint : undefined,
    hasCustomEndpoint: Boolean(env.dynamodbEndpoint),
  });
}

const clientConfig: DynamoDBClientConfig = {
  region,
};

if (isOffline) {
  clientConfig.endpoint = localEndpoint;
  clientConfig.credentials = { accessKeyId: 'dummy', secretAccessKey: 'dummy' };
}

const marshallOptions = {
  removeUndefinedValues: true,
};

const unmarshallOptions = {
  wrapNumbers: false,
};

const client = new DynamoDBClient(clientConfig);

export const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions,
  unmarshallOptions,
});
