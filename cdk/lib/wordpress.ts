import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class WordpressService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Lambda handler
        const handler = new lambda.Function(this, 'rv-wp-handler', {
            runtime: lambda.Runtime.PROVIDED_AL2,
            code: lambda.Code.fromAsset('../wordpress-build'),
            handler: 'index.php',
            memorySize: 1024,
            layers: [
                lambda.LayerVersion.fromLayerVersionArn(
                    this,
                    'php-73-fpm',
                    'arn:aws:lambda:us-east-2:209497400698:layer:php-73-fpm:80'
                ),
            ],
        });

        // APIGW
        const api = new apigateway.RestApi(this, 'rv-wp-api', {
            restApiName: 'RV WP API service',
        });

        const wpIntegration = new apigateway.LambdaIntegration(handler);

        api.root.addMethod('ANY', wpIntegration);
    }
}
