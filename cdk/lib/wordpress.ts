import { Construct } from 'constructs';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Function, Runtime, Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Vpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Duration } from 'aws-cdk-lib';
import { RestApiOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
    Distribution,
    SecurityPolicyProtocol,
    AllowedMethods,
    ViewerProtocolPolicy,
    CachePolicy,
    CacheCookieBehavior,
    CacheQueryStringBehavior,
} from 'aws-cdk-lib/aws-cloudfront';
import { HostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';

export class WordpressService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Lambda handler
        const handler = new Function(this, 'LambdaHandler', {
            runtime: Runtime.PROVIDED_AL2,
            code: Code.fromAsset('../wordpress'),
            handler: 'index.php',
            memorySize: 1024,
            layers: [
                LayerVersion.fromLayerVersionArn(
                    this,
                    'php-73-fpm',
                    'arn:aws:lambda:us-east-2:209497400698:layer:php-73-fpm:80'
                ),
            ],
            allowPublicSubnet: true,
            // Get existing VPC and security group for RDS access
            vpc: Vpc.fromLookup(this, process.env.VPC_ID as string, {
                vpcId: process.env.VPC_ID as string,
            }),
            securityGroups: [
                SecurityGroup.fromLookupById(this, process.env.SG_ID as string, process.env.SG_ID as string),
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
            },
        });

        // APIGW
        const api = new RestApi(this, 'Api', {
            restApiName: 'RV WP API service',
        });

        const wpIntegration = new LambdaIntegration(handler);

        // Root handler
        api.root.addMethod('ANY', wpIntegration);
        // Send all child URLs to index.php as well
        api.root.addProxy({
            defaultIntegration: wpIntegration,
        });

        // Cloudfront
        const siteDomain = 'rv.squawk1200.net';
        const zone = HostedZone.fromLookup(this, 'Zone', { domainName: 'squawk1200.net' });
        const distribution = new Distribution(this, 'Distribution', {
            certificate: new DnsValidatedCertificate(this, 'Certificate', {
                domainName: siteDomain,
                hostedZone: zone,
                region: 'us-east-1',
            }),
            domainNames: [siteDomain],
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: {
                origin: new RestApiOrigin(api),
                allowedMethods: AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                // No caching by default
                cachePolicy: CachePolicy.CACHING_DISABLED,
            },
        });

        // Put theme content into existing asset bucket
        const assetBucket = Bucket.fromBucketArn(this, 'AssetBucket', process.env.ASSET_BUCKET_ARN as string);
        const assetBucketOrigin = new S3Origin(assetBucket);
        const assetBehaviorOptions = {
            allowedMethods: AllowedMethods.ALLOW_ALL,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: new CachePolicy(this, 'StaticContentPolicy', {
                cookieBehavior: CacheCookieBehavior.none(),
                defaultTtl: Duration.days(90),
                queryStringBehavior: CacheQueryStringBehavior.none(),
            }),
        };
        distribution.addBehavior('wp-content/themes/*', assetBucketOrigin, assetBehaviorOptions);
        new BucketDeployment(this, 'AssetDeployment', {
            sources: [
                Source.asset('../wordpress/wp-content/themes', {
                    exclude: ['*.php'],
                }),
            ],
            accessControl: BucketAccessControl.PUBLIC_READ,
            destinationBucket: assetBucket,
            destinationKeyPrefix: 'wp-content/themes',
            distribution: distribution,
        });

        // CF behavior for uploaded images
        distribution.addBehavior('content/*', assetBucketOrigin, assetBehaviorOptions);

        // DNS
        new ARecord(this, 'AliasRecord', {
            recordName: siteDomain,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
            zone: zone,
        });
    }
}
