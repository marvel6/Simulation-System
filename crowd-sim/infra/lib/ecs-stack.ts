import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as alb from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface EcsStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    redisEndpoint: string;
    clientSecurityGroup: ec2.SecurityGroup;
    /** Redis server SG id — imported by id to avoid RedisStack ↔ EcsStack cycles */
    redisSecurityGroupId: string;
}

export class EcsStack extends cdk.Stack {

    private readonly redisUrl: string;
    private readonly vpc: ec2.Vpc;

    constructor(scope: Construct, id: string, props: EcsStackProps) {
        super(scope, id, props);

        this.vpc = props.vpc;
        const cluster = new ecs.Cluster(this, `Ec2Cluster`, { vpc: props.vpc })

        this.redisUrl = `redis://${props.redisEndpoint}`

        const simulationImage = ecs.ContainerImage.fromAsset('..', {
            file: 'services/simulation/Dockerfile',
        })
        const orchestratorImage = ecs.ContainerImage.fromAsset('..', {
            file: 'services/orchestrator/Dockerfile'
        })
        const viewerImage = ecs.ContainerImage.fromAsset('..', {
            file: 'services/viewer/Dockerfile'
        })

        const albSg = new ec2.SecurityGroup(this, 'ViewerAlbSg', {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Public ALB for the crowd-sim viewer',
        })
        albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Public HTTP')

        const viewerSg = new ec2.SecurityGroup(this, 'ViewerServiceSg', {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Viewer tasks (ALB target + Redis client)',
        })
        viewerSg.addIngressRule(albSg, ec2.Port.tcp(8080), 'ALB to viewer')

        // Allow viewer → Redis without creating RedisStack → EcsStack dependency
        const redisSg = ec2.SecurityGroup.fromSecurityGroupId(
            this,
            'ImportedRedisSg',
            props.redisSecurityGroupId,
            { mutable: true }
        )
        redisSg.addIngressRule(viewerSg, ec2.Port.tcp(6379), 'Viewer to Redis')

        const loadBalancer = new alb.ApplicationLoadBalancer(this, 'ViewerAlb', {
            vpc: this.vpc,
            internetFacing: true,
            securityGroup: albSg,
        })
        loadBalancer.setAttribute('idle_timeout.timeout_seconds', '60')

        this.getPartitions().forEach(partition => {

            const partitionId = `partition-${partition}`

            const taskDefinition = new ecs.FargateTaskDefinition(this, `${partition}-TaskDef`, {
                runtimePlatform: {
                    cpuArchitecture: ecs.CpuArchitecture.ARM64,
                    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
                }
            })

            taskDefinition.addContainer("CrowdSimContainer", {
                image: simulationImage,
                memoryLimitMiB: 512,
                cpu: 256,
                environment: {
                    REDIS_URL: this.redisUrl,
                    PARTITION_ID: partitionId,
                },
                logging: new ecs.AwsLogDriver({ streamPrefix: partitionId })
            })

            const service = new ecs.FargateService(this, `${partition}-CrowdSimService`, {
                cluster: cluster,
                taskDefinition: taskDefinition,
                desiredCount: 1,
                circuitBreaker: {
                    rollback: true,
                    enable: true
                },
                securityGroups: [props.clientSecurityGroup],
                vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
                minHealthyPercent: 0,
                maxHealthyPercent: 200,
            })

            new cdk.CfnOutput(this, `${partition}-CrowdSimServiceOutput`, {
                value: service.serviceName,
                description: "The name of the CrowdSim service",
            })
        });

        const orchestratorTaskDefinition = new ecs.FargateTaskDefinition(this, 'OrchestratorTaskDef', {
            runtimePlatform: {
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
            }
        })

        const viewerTaskDefinition = new ecs.FargateTaskDefinition(this, 'ViewerDefinition', {
            runtimePlatform: {
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
            }
        })

        orchestratorTaskDefinition.addContainer('OrchestratorContainer', {
            image: orchestratorImage,
            memoryLimitMiB: 512,
            cpu: 256,
            environment: {
                REDIS_URL: this.redisUrl,
                ORCHESTRATOR_INTERVAL_MS: '2000',
                REBALANCE_ENABLED: 'true',
            },
            logging: new ecs.AwsLogDriver({ streamPrefix: 'orchestrator' })
        })

        viewerTaskDefinition.addContainer('ViewerContainer', {
            image: viewerImage,
            memoryLimitMiB: 512,
            cpu: 256,
            environment: {
                REDIS_URL: this.redisUrl,
                VIEWER_STREAM_MS: '200',
                PORT: '8080',
            },
            logging: new ecs.AwsLogDriver({ streamPrefix: 'viewer' }),
            portMappings: [{
                containerPort: 8080,
                protocol: ecs.Protocol.TCP,
            }]
        })

        new ecs.FargateService(this, 'OrchestratorService', {
            cluster: cluster,
            taskDefinition: orchestratorTaskDefinition,
            desiredCount: 1,
            circuitBreaker: {
                enable: true,
                rollback: true,
            },
            securityGroups: [props.clientSecurityGroup],
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            maxHealthyPercent: 200,
            minHealthyPercent: 0
        })

        const viewerService = new ecs.FargateService(this, 'ViewerService', {
            cluster: cluster,
            taskDefinition: viewerTaskDefinition,
            desiredCount: 1,
            circuitBreaker: {
                enable: true,
                rollback: true,
            },
            maxHealthyPercent: 200,
            minHealthyPercent: 0,
            securityGroups: [viewerSg],
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        });

        const listener = loadBalancer.addListener('HttpListener', {
            port: 80,
            protocol: alb.ApplicationProtocol.HTTP,
        })

        listener.addTargets('ViewerTarget', {
            port: 8080,
            protocol: alb.ApplicationProtocol.HTTP,
            targets: [viewerService],
            healthCheck: {
                path: '/api/health',
                healthyHttpCodes: '200',
            },
        })

        new cdk.CfnOutput(this, 'ViewerUrl', {
            value: `http://${loadBalancer.loadBalancerDnsName}`,
            description: 'Public URL for the crowd-sim viewer',
        })

        new cdk.CfnOutput(this, 'ViewerServiceOutput', {
            value: viewerService.serviceName,
            description: 'The name of the Viewer service',
        })
    }

    private getPartitions(): string[] {
        return ['A', 'B', 'C', 'D',];
    }
}
