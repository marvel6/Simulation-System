#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { NetworkStack } from '../lib/network-stack';

const app = new cdk.App();
new NetworkStack(app, 'NetworkStack', {

});
