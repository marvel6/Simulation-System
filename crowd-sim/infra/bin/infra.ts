#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { EcsStack } from '../lib/ecs-stack';
import { RedisStack } from '../lib/redis-stack';
import { NetworkStack } from '../lib/network-stack';

const env = {
  account: '841666121059',
  region: 'us-east-1',
};

const app = new cdk.App();
const networkStack = new NetworkStack(app, 'NetworkStack', {
  stackName: 'Crowd-Sim-Network-Stack',
  env: env,
});

const redisStack = new RedisStack(app, 'RedisStack', {
  stackName: 'Crowd-Sim-Redis-Stack',
  vpc: networkStack.vpc,
  env: env,
});

new EcsStack(app, 'EcsStack', {
  stackName: 'Crowd-Sim-Ecs-Stack',
  vpc: networkStack.vpc,
  env: env,
  redisEndpoint: redisStack.redisEndpoint,
  clientSecurityGroup: redisStack.clientSecurityGroup,
});