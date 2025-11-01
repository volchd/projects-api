import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// When running serverless-offline, we want to hit the local DynamoDB in Docker.
// We'll detect this via IS_OFFLINE env var set by serverless-offline, or allow override with DYNAMODB_ENDPOINT.
const offlineValue = process.env.IS_OFFLINE as unknown;
const isOffline = offlineValue === true || offlineValue === 'true' || offlineValue === '1';

const localEndpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const region = process.env.AWS_REGION ?? 'us-east-1';

if ((process.env.DEBUG ?? '').includes('dynamodb') || isOffline) {
  console.log('[dynamodb] Initializing client', {
    region,
    isOffline,
    endpoint: isOffline ? localEndpoint : undefined,
    hasCustomEndpoint: Boolean(process.env.DYNAMODB_ENDPOINT),
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
