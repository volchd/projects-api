'use strict';

const fs = require('fs');
const path = require('path');

class LocalEnvPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');

    this.hooks = {
      'after:deploy:deploy': this.writeLocalEnv.bind(this),
    };
  }

  async writeLocalEnv() {
    const stage = this.getStage();
    if (stage !== 'local-dev') {
      return;
    }

    const stackName = `${this.getServiceName()}-${stage}`;
    const stack = await this.describeStack(stackName);
    const outputs = stack?.Outputs || [];
    const poolId = this.pickOutput(outputs, 'CognitoUserPoolId');
    const clientId = this.pickOutput(outputs, 'CognitoUserPoolClientId');

    if (!poolId || !clientId) {
      throw new Error('Cognito outputs not found; deploy may have failed');
    }

    this.updateApiEnvFile({ poolId, clientId });
    this.updateUiEnvFile({ poolId, clientId });
  }

  getStage() {
    if (this.options && this.options.stage) {
      return this.options.stage;
    }
    if (this.provider && typeof this.provider.getStage === 'function') {
      return this.provider.getStage();
    }
    return this.serverless.service.provider.stage || 'dev';
  }

  getRegion() {
    if (this.options && this.options.region) {
      return this.options.region;
    }
    if (this.provider && typeof this.provider.getRegion === 'function') {
      return this.provider.getRegion();
    }
    return this.serverless.service.provider.region || 'us-east-1';
  }

  getServiceName() {
    if (this.serverless.service.getServiceName) {
      return this.serverless.service.getServiceName();
    }
    return this.serverless.service.service;
  }

  async describeStack(stackName) {
    try {
      const result = await this.provider.request('CloudFormation', 'describeStacks', {
        StackName: stackName,
      });
      return result.Stacks && result.Stacks[0];
    } catch (error) {
      this.serverless.cli.log(`[local-env] Failed to inspect stack ${stackName}`);
      throw error;
    }
  }

  pickOutput(outputs, key) {
    const match = outputs.find((entry) => entry.OutputKey === key);
    return match && match.OutputValue;
  }

  updateApiEnvFile({ poolId, clientId }) {
    const serviceDir = this.getServiceDir();
    const envPath = path.join(serviceDir, '.env.local');
    const templatePath = path.join(serviceDir, '.env.example');
    this.writeEnvFile({
      envPath,
      templatePath,
      values: {
        COGNITO_USER_POOL_ID: poolId,
        COGNITO_USER_POOL_CLIENT_ID: clientId,
      },
      logSuffix: 'Cognito IDs',
    });
  }

  updateUiEnvFile({ poolId, clientId }) {
    const serviceDir = this.getServiceDir();
    const uiDir = path.resolve(serviceDir, '..', 'ui');
    if (!fs.existsSync(uiDir) || !fs.statSync(uiDir).isDirectory()) {
      this.serverless.cli.log(`[local-env] Skipping UI env update; ${uiDir} not found`);
      return;
    }

    const envPath = path.join(uiDir, '.env.local');
    const templatePath = path.join(uiDir, '.env.example');
    this.writeEnvFile({
      envPath,
      templatePath,
      values: {
        VITE_COGNITO_REGION: this.getRegion(),
        VITE_COGNITO_USER_POOL_ID: poolId,
        VITE_COGNITO_USER_POOL_CLIENT_ID: clientId,
      },
      logSuffix: 'UI Cognito IDs',
    });
  }

  getServiceDir() {
    return this.serverless.config.servicePath || this.serverless.serviceDir;
  }

  writeEnvFile({ envPath, templatePath, values, logSuffix }) {
    let contents = '';
    if (fs.existsSync(envPath)) {
      contents = fs.readFileSync(envPath, 'utf8');
    } else if (fs.existsSync(templatePath)) {
      contents = fs.readFileSync(templatePath, 'utf8');
    }

    contents = Object.entries(values).reduce(
      (acc, [key, value]) => this.upsertEnv(acc, key, value),
      contents,
    );

    if (!contents.endsWith('\n')) {
      contents += '\n';
    }

    fs.writeFileSync(envPath, contents, 'utf8');
    const relativePath = path.relative(this.getServiceDir(), envPath) || path.basename(envPath);
    this.serverless.cli.log(
      `[local-env] Updated ${relativePath} with ${logSuffix || 'environment values'}`,
    );
  }

  upsertEnv(source, key, value) {
    const line = `${key}=${value}`;
    const matcher = new RegExp(`^${key}=.*$`, 'm');

    if (matcher.test(source)) {
      return source.replace(matcher, line);
    }

    const needsNewline = source.length > 0 && !source.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';
    return `${source}${prefix}${line}\n`;
  }
}

module.exports = LocalEnvPlugin;
