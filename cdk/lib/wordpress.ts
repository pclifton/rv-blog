import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export class WordpressService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        
        // Lambda handler
        const handler = new lambda.Function(this, 'LambdaHandler', {
            runtime: lambda.Runtime.PROVIDED_AL2,
            code: lambda.Code.fromAsset('../wordpress'),
            handler: 'index.php',
            memorySize: 1024,
            layers: [
                lambda.LayerVersion.fromLayerVersionArn(
                    this,
                    'php-73-fpm',
                    'arn:aws:lambda:us-east-2:209497400698:layer:php-73-fpm:80'
                ),
            ],
            allowPublicSubnet: true,
            // Get existing VPC and security group for RDS access
            vpc: ec2.Vpc.fromLookup(this, process.env.VPC_ID as string, {
                vpcId: process.env.VPC_ID as string
            }),
            securityGroups: [
                ec2.SecurityGroup.fromLookupById(this, process.env.SG_ID as string, process.env.SG_ID as string)
            ],
            environment: {
                WORDPRESS_DB_HOST: process.env.WORDPRESS_DB_HOST as string,
                WORDPRESS_DB_USER: process.env.WORDPRESS_DB_USER as string,
                WORDPRESS_DB_PASSWORD: process.env.WORDPRESS_DB_PASSWORD as string,
                WORDPRESS_DB_NAME: process.env.WORDPRESS_DB_NAME as string,
                WP_AUTH_KEY: process.env.WP_AUTH_KEY as string,
                WP_SECURE_AUTH_KEY: process.env.WP_SECURE_AUTH_KEY as string,
                WP_LOGGED_IN_KEY: process.env.WP_LOGGED_IN_KEY as string,
                WP_NONCE_KEY: process.env.WP_NONCE_KEY as string,
                WP_AUTH_SALT: process.env.WP_AUTH_SALT as string,
                WP_SECURE_AUTH_SALT: process.env.WP_SECURE_AUTH_SALT as string,
                WP_LOGGED_IN_SALT: process.env.WP_LOGGED_IN_SALT as string,
                WP_NONCE_SALT: process.env.WP_NONCE_SALT as string,
                S3_UPLOADS_BUCKET: process.env.S3_UPLOADS_BUCKET as string,
                S3_UPLOADS_REGION: process.env.S3_UPLOADS_REGION as string,
                S3_UPLOADS_USE_INSTANCE_PROFILE: process.env.S3_UPLOADS_USE_INSTANCE_PROFILE as string,
                S3_UPLOADS_KEY: process.env.S3_UPLOADS_KEY as string,
                S3_UPLOADS_SECRET: process.env.S3_UPLOADS_SECRET as string,
            }
        });

        // APIGW
        const api = new apigateway.RestApi(this, 'Api', {
            restApiName: 'RV WP API service',
        });

        const wpIntegration = new apigateway.LambdaIntegration(handler);

        // Root handler
        api.root.addMethod('ANY', wpIntegration);
        // Send all child URLs to index.php as well
        api.root.addProxy({
            defaultIntegration: wpIntegration
        });

        // Cloudfront
        const siteDomain = 'rv1.squawk1200.net';
        const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: 'squawk1200.net' });
        const distribution = new cloudfront.Distribution(this, 'Distribution', {
            certificate: new acm.DnsValidatedCertificate(this, 'Certificate', {
                domainName: siteDomain,
                hostedZone: zone,
                region: 'us-east-1',
            }),
            domainNames: [siteDomain],
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: {
                origin: new cloudfront_origins.RestApiOrigin(api),
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                // No caching by default
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            }
        });

        distribution.addBehavior('wp-content/*', new cloudfront_origins.RestApiOrigin(api), {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: new cloudfront.CachePolicy(this, 'StaticContentPolicy', {
                cookieBehavior: cloudfront.CacheCookieBehavior.none(),
                defaultTtl: cdk.Duration.days(90),
                queryStringBehavior: cloudfront.CacheQueryStringBehavior.none()
            }),
        });

        new route53.ARecord(this, 'AliasRecord', {
            recordName: siteDomain,
            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
            zone: zone
        });
    }
}
