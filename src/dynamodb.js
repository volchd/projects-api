const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// When running serverless-offline, we want to hit the local DynamoDB in Docker.
// We'll detect this via IS_OFFLINE env var set by serverless-offline, or allow override with DYNAMODB_ENDPOINT.
const isOffline = process.env.IS_OFFLINE === 'true' || process.env.IS_OFFLINE === true;
const localEndpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';

const region = process.env.AWS_REGION || 'us-east-1';

if (process.env.DEBUG?.includes('dynamodb') || isOffline) {
  console.log('[dynamodb] Initializing client', {
    region,
    isOffline,
    endpoint: isOffline ? localEndpoint : undefined,
    hasCustomEndpoint: Boolean(process.env.DYNAMODB_ENDPOINT),
  });
}

const client = new DynamoDBClient({
  region,
  ...(isOffline && { endpoint: localEndpoint, credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' } })
});

const marshallOptions = {
  removeUndefinedValues: true,
};

const unmarshallOptions = {
  wrapNumbers: false,
};

const ddbDocClient = DynamoDBDocumentClient.from(client, { marshallOptions, unmarshallOptions });

module.exports = { ddbDocClient };
