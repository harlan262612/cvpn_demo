import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { ClientRequest } from 'http';
import { Vpc } from '@aws-cdk/aws-ec2';
import { CfnOutput } from '@aws-cdk/core';

export class CvpnStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpn = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 3,
      natGateways: 1,
      cidr: '10.0.0.0/16',
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'ingress',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'application',
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 28,
          name: 'rds',
          subnetType: ec2.SubnetType.ISOLATED,
        },
        {
          cidrMask: 27,
          name: 'cvpn',
          subnetType: ec2.SubnetType.ISOLATED,
        }
      ]
    })
    const acmArn = 'arn:aws:acm:ap-northeast-1:354431492655:certificate/8bd7a4d3-02a6-40da-a4c0-1fb7094eed8a'

    const ep = new ec2.CfnClientVpnEndpoint(this, 'Endpoint', {
      authenticationOptions: [
        {
          type: 'certificate-authentication',
          mutualAuthentication: {
            clientRootCertificateChainArn: acmArn,
          }
        }
      ]
      clientCidrBlock: '10.0.252.0/22',
      connectionLogOptions: {
        enabled: false
      },
      serverCertificateArn: acmArn,
      //splitTunnel: true
    })
    
    const association = new ec2.CfnClientVpnTargetNetworkAssociation(this, 'Asso', {
      clientVpnEndpointId: ep.ref,
      subnetId: vpn.selectSubnets({
        subnetName: 'cvpn'
      }).subnetIds[0]
    })

    const authz = new ec2.CfnClientVpnAuthorizationRule(this, 'Authz', {
      clientVpnEndpointId: ep.ref,
      targetNetworkCidr: vpc.vpcCidrBlock,
      authorizeAllGroups: true,
    })
    //const authzPublic = new ec2.CfnClientVpnAuthorizationRule(this, 'AuthzPublic', {
    //  clientVpnEndpointId: ep.ref,
    //  targetNetworkCidr: '0.0.0.0/0',
    //  authorizeAllGroups: true,
    //})

    const route = new ec2.CfnClientVpnAuthorizationRule(this, 'Route',{
      clientVpnEndpointId: ep.ref
      destinationCidrBlock: '0.0.0.0/0',
      targetVpcSubnetId: vpc.selectSubnets({
        subnetName: 'cvpn'
      }).subnetIds[0]
    })

    const instance = new ec2.Instance(this, 'PingTest', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
      vpc,
    })

    instance.connections.allowFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.icmpPing())

    new CfnOutput(this, 'PingTest', { value: instance.instancePrivateIp})

  }
}