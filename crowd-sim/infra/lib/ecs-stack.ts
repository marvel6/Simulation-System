import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface EcsStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    redisEndpoint: string;
}

export class EcsStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: EcsStackProps) {
        super(scope, id, props);

        const cluster = new ecs.Cluster(this, `Ec2Cluster`, { vpc: props.vpc })

        this.getPartitions().forEach(partition => {

            const taskDefinition = new ecs.FargateTaskDefinition(this, `${partition}-TaskDef`)

            taskDefinition.addContainer("CrowdSimContainer", {
                image: ecs.ContainerImage.fromRegistry("crowd-sim:latest"),
                memoryLimitMiB: 512,
                cpu: 256,
                portMappings: [{
                    containerPort: 8080,
                }],
                environment: {
                    REDIS_ENDPOINT: props.redisEndpoint,
                }
            })

            const service = new ecs.FargateService(this, `${partition}-CrowdSimService`, {
                cluster: cluster,
                taskDefinition: taskDefinition,
                desiredCount: 1,
                circuitBreaker: {
                    rollback: true,
                    enable: true
                }
            })

            new cdk.CfnOutput(this, `${partition}-CrowdSimServiceOutput`, {
                value: service.serviceName,
                description: "The name of the CrowdSim service",
            })

            cluster.addCapacity("DefaultCapicity", {
                desiredCapacity: 1,
                maxCapacity: 1,
                instanceType: new ec2.InstanceType('t3.micro'),
            })
        })
    }

    private getPartitions(): string[] {
        return ['A', 'B', 'C', 'D',];
    }
}