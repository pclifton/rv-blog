import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WordpressService } from './wordpress';

export class RVBlogStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here
        new WordpressService(this, 'rv-wp');
    }
}
