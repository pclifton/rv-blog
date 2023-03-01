import { Construct } from 'constructs';
import { RestApi, LambdaIntegration, LogGroupLogDestination, DomainName } from 'aws-cdk-lib/aws-apigateway';
import { Function, Runtime, Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Vpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Duration } from 'aws-cdk-lib';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
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
import { ApiGatewayDomain, CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

export class WordpressService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Lambda handlers
        const baseHandlerOptions = {
            runtime: Runtime.PROVIDED_AL2,
            code: Code.fromAsset('../wordpress'),
            memorySize: 1024,
            layers: [
                LayerVersion.fromLayerVersionArn(
                    this,
                    'php-73-fpm',
                    'arn:aws:lambda:us-east-2:209497400698:layer:php-73-fpm:80'
                ),
            ],
            logRetention: RetentionDays.ONE_MONTH,
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
        };
        const siteHandler = new Function(this, 'LambdaSiteHandler', {
            ...baseHandlerOptions,
            handler: 'index.php',
        });
        const apiHandler = new Function(this, 'LambdaApiHandler', {
            ...baseHandlerOptions,
            handler: 'xmlrpc.php',
            timeout: Duration.seconds(10),
        });

        // APIGW
        const api = new RestApi(this, 'Api', {
            restApiName: 'RV WP API service',
            deployOptions: {
                accessLogDestination: new LogGroupLogDestination(
                    new LogGroup(this, 'GatewayLogs', {
                        retention: RetentionDays.ONE_MONTH,
                    })
                ),
            },
        });

        const siteIntegration = new LambdaIntegration(siteHandler, {
            requestParameters: {
                'integration.request.querystring.s': 'method.request.querystring.s',
            },
        });
        const apiIntegration = new LambdaIntegration(apiHandler);

        // Root handler
        api.root.addMethod('ANY', siteIntegration, {
            requestParameters: {
                'method.request.querystring.s': false,
            },
        });
        // XML-RPC handler
        api.root
            .addResource('xmlrpc.php', {
                defaultIntegration: apiIntegration,
            })
            .addMethod('POST', apiIntegration);
        // Send all other child URLs to index.php
        api.root.addProxy({
            defaultIntegration: siteIntegration,
            defaultMethodOptions: {
                requestParameters: {
                    'method.request.querystring.s': false,
                },
            },
        });

        // Need this zone for two different domain setups
        const zone = HostedZone.fromLookup(this, 'Zone', { domainName: 'squawk1200.net' });

        // Set up the domain for regular web requests
        const siteDomain = 'rv.squawk1200.net';
        const siteDomainName = new DomainName(this, 'SiteDomain', {
            certificate: new DnsValidatedCertificate(this, 'SiteCertificate', {
                domainName: siteDomain,
                hostedZone: zone,
                region: 'us-east-2',
            }),
            domainName: siteDomain,
            mapping: api,
        });
        // DNS
        new ARecord(this, 'SiteRecord', {
            recordName: siteDomain,
            target: RecordTarget.fromAlias(new ApiGatewayDomain(siteDomainName)),
            zone: zone,
        });

        // Set up Cloudfront for static assets
        const assetDomain = 'rv-static.squawk1200.net';
        const distribution = new Distribution(this, 'AssetDistribution', {
            certificate: new DnsValidatedCertificate(this, 'AssetCertificate', {
                domainName: assetDomain,
                hostedZone: zone,
                region: 'us-east-1',
            }),
            domainNames: [assetDomain],
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: {
                origin: new S3Origin(Bucket.fromBucketArn(this, 'AssetBucket', process.env.ASSET_BUCKET_ARN as string)),
                allowedMethods: AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: new CachePolicy(this, 'AssetPolicy', {
                    cookieBehavior: CacheCookieBehavior.none(),
                    defaultTtl: Duration.days(90),
                    queryStringBehavior: CacheQueryStringBehavior.none(),
                }),
            },
        });
        // DNS
        new ARecord(this, 'AssetRecord', {
            recordName: assetDomain,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
            zone: zone,
        });
    }
}
