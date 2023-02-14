#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config()

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RVBlogStack } from '../lib/rv-blog-stack';

const app = new cdk.App();
new RVBlogStack(app, 'RVBlogStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
