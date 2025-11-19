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

    this.updateEnvFile({ poolId, clientId });
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

  updateEnvFile({ poolId, clientId }) {
    const serviceDir = this.serverless.config.servicePath || this.serverless.serviceDir;
    const envPath = path.join(serviceDir, '.env.local');
    const templatePath = path.join(serviceDir, '.env.example');

    let contents = '';
    if (fs.existsSync(envPath)) {
      contents = fs.readFileSync(envPath, 'utf8');
    } else if (fs.existsSync(templatePath)) {
      contents = fs.readFileSync(templatePath, 'utf8');
    }

    contents = this.upsertEnv(contents, 'COGNITO_USER_POOL_ID', poolId);
    contents = this.upsertEnv(contents, 'COGNITO_USER_POOL_CLIENT_ID', clientId);

    if (!contents.endsWith('\n')) {
      contents += '\n';
    }

    fs.writeFileSync(envPath, contents, 'utf8');
    const relativePath = path.relative(serviceDir, envPath) || '.env.local';
    this.serverless.cli.log(`[local-env] Updated ${relativePath} with Cognito IDs`);
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
