import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';

export interface RedisStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
}

export class RedisStack extends cdk.Stack {
    public readonly redisEndpoint: string;
    public readonly securityGroup: ec2.SecurityGroup;
    public readonly clientSecurityGroup: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props: RedisStackProps) {
        super(scope, id, props);

        this.securityGroup = new ec2.SecurityGroup(this, 'CrowdSimRedisSecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for CrowdSim Redis',
            allowAllOutbound: false,
        });

        this.clientSecurityGroup = new ec2.SecurityGroup(this, 'CrowdSimRedisClientSecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for CrowdSim Redis clients',
            allowAllOutbound: true,
        });

        this.securityGroup.addIngressRule(this.clientSecurityGroup, ec2.Port.tcp(6379), 'Allow Redis access from ECS clients only');


        const subnetGroup = new elasticache.CfnSubnetGroup(this, 'ClusterSubnetGroup', {
            description: 'Subnet group for CrowdSim Redis',
            subnetIds: props.vpc.privateSubnets.map(subnets => subnets.subnetId)
        })

        const cluster = new elasticache.CfnCacheCluster(this, 'CrowdSimCluster', {
            clusterName: 'Crowd-Sim-Redis-Cluster',
            engine: 'redis',
            cacheNodeType: 'cache.t3.micro',
            numCacheNodes: 1,
            vpcSecurityGroupIds: [this.securityGroup.securityGroupId],
            cacheSubnetGroupName: subnetGroup.ref,
            engineVersion: '7.0',
        })

        this.redisEndpoint = `${cluster.attrRedisEndpointAddress}:${cluster.attrRedisEndpointPort}`


        new cdk.CfnOutput(this, "RedisEndpointOutput", {
            value: this.redisEndpoint,
            description: 'Redis endpoint',
        });
    }
}