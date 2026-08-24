import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BastionStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  /** Same SG ECS uses — allows this host to reach Redis :6379 */
  clientSecurityGroup: ec2.SecurityGroup;
  /** e.g. host:port — used only in CLI output helpers */
  redisEndpoint: string;
}

/**
 * SSM-only jump host for experimenting from a laptop.
 * No SSH, no public IP — connect with Session Manager port-forward.
 */
export class BastionStack extends cdk.Stack {
  public readonly instanceId: string;

  constructor(scope: Construct, id: string, props: BastionStackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'BastionRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Crowd-sim bastion SSM Session Manager only',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const bastion = new ec2.Instance(this, 'BastionHost', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
      }),
      role,
      securityGroup: props.clientSecurityGroup,
      requireImdsv2: true,
    });

    // No inbound rules needed — SSM is outbound via NAT to AWS APIs.
    cdk.Tags.of(bastion).add('Name', 'crowd-sim-ssm-bastion');

    this.instanceId = bastion.instanceId;

    const redisHost = props.redisEndpoint.split(':')[0];

    new cdk.CfnOutput(this, 'BastionInstanceId', {
      value: bastion.instanceId,
      description: 'Use as --target for aws ssm start-session',
    });

    new cdk.CfnOutput(this, 'RedisPortForwardCommand', {
      value: [
        'aws ssm start-session',
        `--target ${bastion.instanceId}`,
        '--document-name AWS-StartPortForwardingSessionToRemoteHost',
        `--parameters '{"host":["${redisHost}"],"portNumber":["6379"],"localPortNumber":["6379"]}'`,
      ].join(' '),
      description: 'Run locally (needs Session Manager plugin). Then REDIS_URL=redis://127.0.0.1:6379',
    });
  }
}
