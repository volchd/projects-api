import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

type NodeEnv = 'development' | 'test' | 'production' | (string & {});

const appRoot = path.resolve(__dirname, '..', '..');
const nodeEnv = (process.env.NODE_ENV?.toLowerCase() as NodeEnv) ?? 'development';

const envFilesInPriorityOrder: Array<{ path: string; override: boolean }> = [
  { path: `.env.${nodeEnv}.local`, override: true },
  { path: '.env.local', override: true },
  { path: `.env.${nodeEnv}`, override: false },
  { path: '.env', override: false },
];

const loadedFiles: string[] = [];

for (const { path: relativePath, override } of envFilesInPriorityOrder) {
  const fullPath = path.join(appRoot, relativePath);
  if (fs.existsSync(fullPath)) {
    loadEnv({ path: fullPath, override });
    loadedFiles.push(relativePath);
  }
}

const normalize = (value: string | undefined): string => value?.trim() ?? '';

const readOptionalString = (key: string, fallback?: string): string | undefined => {
  const value = normalize(process.env[key]);
  if (!value) {
    return fallback;
  }
  return value;
};

const readBoolean = (key: string, fallback = false): boolean => {
  const value = normalize(process.env[key]).toLowerCase();
  if (!value) {
    return fallback;
  }
  return value === '1' || value === 'true' || value === 'yes' || value === 'y' || value === 'on';
};

const baseConfig = {
  nodeEnv,
  awsRegion: readOptionalString('AWS_REGION', 'us-east-1')!,
  isOffline: readBoolean('IS_OFFLINE', false),
  dynamodbEndpoint: readOptionalString('DYNAMODB_ENDPOINT'),
  debugNamespaces: readOptionalString('DEBUG'),
  cognito: {
    userPoolId: readOptionalString('COGNITO_USER_POOL_ID', 'us-east-1_9SfZWZEAH')!,
    userPoolClientId: readOptionalString('COGNITO_USER_POOL_CLIENT_ID', '5h87m4j2ab9lanjq9ks466sbj9')!,
  },
  cors: {
    allowedOrigin: readOptionalString('CORS_ALLOWED_ORIGIN', '*')!,
    allowedHeaders: readOptionalString('CORS_ALLOWED_HEADERS', 'Content-Type,Authorization')!,
    allowedMethods: readOptionalString('CORS_ALLOWED_METHODS', 'OPTIONS,GET,POST,PUT,DELETE')!,
  },
} as const;

export const env = {
  ...baseConfig,
  /**
   * TABLE_NAME is injected by Serverless during deploy/offline runs.
   * Tests override the env var directly prior to importing handlers.
   */
  get tableName(): string {
    const value = readOptionalString('TABLE_NAME');
    if (!value) {
      throw new Error('TABLE_NAME environment variable is required');
    }
    return value;
  },
  loadedEnvFiles: Object.freeze(loadedFiles),
} as const;

export type AppEnv = typeof env;
