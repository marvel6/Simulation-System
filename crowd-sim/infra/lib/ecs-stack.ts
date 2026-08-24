import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface EcsStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    redisEndpoint: string;
    clientSecurityGroup: ec2.SecurityGroup;
}

export class EcsStack extends cdk.Stack {

    private readonly redisUrl: string;

    constructor(scope: Construct, id: string, props: EcsStackProps) {
        super(scope, id, props);

        const cluster = new ecs.Cluster(this, `Ec2Cluster`, { vpc: props.vpc })

        this.redisUrl = `redis://${props.redisEndpoint}`

        // Build once from the monorepo root so @crowd-sim/shared is available.
        const simulationImage = ecs.ContainerImage.fromAsset('..', {
            file: 'services/simulation/Dockerfile',
        })
        const orchestratorImage = ecs.ContainerImage.fromAsset('..', {
            file: 'services/orchestrator/Dockerfile'
        })

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

        orchestratorTaskDefinition.addContainer('OrchestratorContainer', {
            image: orchestratorImage,
            memoryLimitMiB: 512,
            cpu: 256,
            environment: {
                REDIS_URL: this.redisUrl,
                ORCHESTRATOR_INTERVAL_MS: '2000'
            },
            logging: new ecs.AwsLogDriver({ streamPrefix: 'orchestrator' })
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
    }

    private getPartitions(): string[] {
        return ['A', 'B', 'C', 'D',];
    }
}