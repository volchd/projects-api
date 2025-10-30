const crypto = require('crypto');
const { ddbDocClient } = require('./dynamodb');
const { PutCommand, GetCommand, DeleteCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { json } = require('./response');

const TABLE_NAME = process.env.TABLE_NAME;
const USER_INDEX = 'UserIndex';

/**
 * Project shape:
 * {
 *   id: string,
 *   userId: string,
 *   name: string,
 *   description?: string
 * }
 */

function validateCreate(payload) {
  const errors = [];
  if (!payload) errors.push('Missing JSON body');
  if (payload && typeof payload.userId !== 'string') errors.push('userId (string) is required');
  if (payload && typeof payload.name !== 'string') errors.push('name (string) is required');
  if (payload && payload.description != null && typeof payload.description !== 'string') errors.push('description must be a string if provided');
  return errors;
}

function validateUpdate(payload) {
  const errors = [];
  if (!payload) errors.push('Missing JSON body');
  if (payload && payload.name != null && typeof payload.name !== 'string') errors.push('name must be a string if provided');
  if (payload && payload.description != null && typeof payload.description !== 'string') errors.push('description must be a string if provided');
  return errors;
}

module.exports.create = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const errors = validateCreate(body);
    if (errors.length) return json(400, { errors });

    const item = {
      id: crypto.randomUUID(),
      userId: body.userId,
      name: body.name,
      description: body.description ?? null,
    };

    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)',
    }));

    return json(201, item);
  } catch (err) {
    console.error(err);
    return json(500, { message: 'Internal server error', error: err.message });
  }
};

module.exports.get = async (event) => {
  try {
    const id = event.pathParameters?.id;
    const res = await ddbDocClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id },
    }));

    if (!res.Item) return json(404, { message: 'Not found' });
    return json(200, res.Item);
  } catch (err) {
    console.error(err);
    return json(500, { message: 'Internal server error', error: err.message });
  }
};

module.exports.listByUser = async (event) => {
  try {
    const userId = event.pathParameters?.userId;
    console.log('[listByUser] Querying projects', {
      table: TABLE_NAME,
      index: USER_INDEX,
      userId,
      envRegion: process.env.AWS_REGION,
      offline: process.env.IS_OFFLINE,
      endpoint: process.env.DYNAMODB_ENDPOINT,
    });
    const res = await ddbDocClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: USER_INDEX,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
    }));
    return json(200, { items: res.Items ?? [] });
  } catch (err) {
    console.error(err);
    return json(500, { message: 'Internal server error', error: err.message });
  }
};

module.exports.update = async (event) => {
  try {
    const id = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');
    const errors = validateUpdate(body);
    if (errors.length) return json(400, { errors });

    const names = [];
    const exprNames = {};
    const exprValues = {};

    if (body.name != null) {
      names.push('#n = :name');
      exprNames['#n'] = 'name';
      exprValues[':name'] = body.name;
    }
    if (body.description != null) {
      names.push('#d = :desc');
      exprNames['#d'] = 'description';
      exprValues[':desc'] = body.description;
    }

    if (names.length === 0) return json(400, { message: 'Nothing to update' });

    const res = await ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: 'SET ' + names.join(', '),
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
      ConditionExpression: 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    }));

    return json(200, res.Attributes);
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      return json(404, { message: 'Not found' });
    }
    console.error(err);
    return json(500, { message: 'Internal server error', error: err.message });
  }
};

module.exports.remove = async (event) => {
  try {
    const id = event.pathParameters?.id;
    await ddbDocClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
      ConditionExpression: 'attribute_exists(id)',
    }));
    return json(204, {});
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      return json(404, { message: 'Not found' });
    }
    console.error(err);
    return json(500, { message: 'Internal server error', error: err.message });
  }
};
