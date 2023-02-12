import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WordpressService } from './wordpress';

export class RVBlogStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here
        new WordpressService(this, 'rv-wp');
    }
}
