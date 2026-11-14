import {
  Annotations,
  CfnOutput,
  Duration,
  aws_ec2 as ec2,
  aws_iam as iam,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_s3 as s3,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

// The AWS side of the deployment (PLAN M10.5): one EC2 instance that runs
// docker-compose.prod.yml (Postgres, API, worker, dashboard, Caddy), the S3 buckets it uses, and
// its permissions. Reached only through Session Manager; no SSH port, no key pair.

// Ubuntu 24.04 LTS, arm64, gp3, in ap-northeast-2 (from Canonical's SSM parameter
// /aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id, 2026-11-10).
// Pinned, not looked up on every deploy: a new AMI replaces the instance, and with it the
// Postgres volume. Update it deliberately, after a backup.
export const UBUNTU_AMI = "ami-093a68505ea068a90";

export interface CommerceStackProps extends StackProps {
  /** Free-plan eligible in ap-northeast-2: t4g.micro (1 GB) or t4g.small (2 GB). */
  instanceType?: string;
  /**
   * The GitHub repository whose `main` branch may deploy (PLAN M12), as its OIDC `sub` claim names
   * it: "owner/name", or "owner@id/name@id" with immutable subjects. Its workflows get the Deploy
   * role through OIDC. Without it, no deploy role is made.
   */
  githubRepository?: string;
}

export class CommerceStack extends Stack {
  constructor(scope: Construct, id: string, props: CommerceStackProps = {}) {
    super(scope, id, props);

    // Product media (ADR-0014): objects are public (MEDIA_PUBLIC_URL), listing is not. Only a
    // bucket policy grants that; ACLs stay blocked.
    const media = new s3.Bucket(this, "Media", {
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    media.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        principals: [new iam.AnyPrincipal()],
        resources: [media.arnForObjects("*")],
      }),
    );

    // Nightly pg_dump files (infra/backup), kept 30 days.
    const backups = new s3.Bucket(this, "Backups", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Docker images and the release files on their way to the instance (no SSH, no registry).
    const artifacts = new s3.Bucket(this, "Artifacts", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(7) }],
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // One public subnet, no NAT gateway (it costs money); the instance has a public address.
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC }],
    });

    // HTTP (Let's Encrypt and the redirect) and HTTPS, including HTTP/3. No SSH.
    const securityGroup = new ec2.SecurityGroup(this, "Web", {
      vpc,
      description: "commerce web: HTTP and HTTPS only",
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP");
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(443), "HTTP/3");

    // The instance's identity: Session Manager, and the buckets. The API and the worker use these
    // credentials through the instance metadata service, so .env.prod holds no AWS keys.
    const role = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });
    media.grantReadWrite(role); // includes delete
    backups.grantPut(role);
    backups.grantRead(role);
    artifacts.grantRead(role);

    const instance = new ec2.Instance(this, "Server", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType ?? "t4g.small"),
      machineImage: ec2.MachineImage.genericLinux({ "ap-northeast-2": UBUNTU_AMI }),
      securityGroup,
      role,
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      userData: ec2.UserData.custom(USER_DATA),
      // A user-data change must not replace the instance (its disk holds Postgres).
      userDataCausesReplacement: false,
    });
    Annotations.of(instance).acknowledgeWarning(
      "CloudFormation-Validate::W9010",
      "The AMI is pinned on purpose (UBUNTU_AMI): a new one replaces the instance.",
    );
    // IMDSv2 only; a hop limit of 2 lets the containers (one network hop further) reach it.
    instance.instance.addPropertyOverride("MetadataOptions", {
      HttpEndpoint: "enabled",
      HttpTokens: "required",
      HttpPutResponseHopLimit: 2,
    });

    // A fixed public address for the DNS A record (admin.dino-craft.lol).
    const address = new ec2.CfnEIP(this, "Address", { instanceId: instance.instanceId });

    new CfnOutput(this, "PublicIp", { value: address.attrPublicIp });
    new CfnOutput(this, "InstanceId", { value: instance.instanceId });
    new CfnOutput(this, "MediaBucket", { value: media.bucketName });
    new CfnOutput(this, "MediaPublicUrl", {
      value: `https://${media.bucketRegionalDomainName}`,
    });
    new CfnOutput(this, "BackupBucket", { value: backups.bucketName });
    new CfnOutput(this, "ArtifactsBucket", { value: artifacts.bucketName });

    if (props.githubRepository) {
      this.addDeployRole(props.githubRepository, artifacts, instance);
    }
  }

  // Continuous deployment (PLAN M12): GitHub Actions sign in through OIDC, so no AWS keys are
  // stored anywhere. Only workflows running on this repository's `main` branch (pushes,
  // workflow_run and manual runs there) can assume the role, and it can only upload images to the
  // artifacts bucket and run a shell command on this one instance (the release script).
  private addDeployRole(repository: string, artifacts: s3.Bucket, instance: ec2.Instance): void {
    const issuer = "token.actions.githubusercontent.com";
    const github = new iam.OidcProviderNative(this, "GitHubOidc", {
      url: `https://${issuer}`,
      clientIds: ["sts.amazonaws.com"],
    });
    const role = new iam.Role(this, "Deploy", {
      description: "GitHub Actions deploys of the main branch (PLAN M12)",
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(github.oidcProviderArn, {
        StringEquals: {
          [`${issuer}:aud`]: "sts.amazonaws.com",
          [`${issuer}:sub`]: `repo:${repository}:ref:refs/heads/main`,
        },
      }),
    });
    artifacts.grantPut(role, "images/*");
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:SendCommand"],
        resources: [
          this.formatArn({
            service: "ec2",
            resource: "instance",
            resourceName: instance.instanceId,
          }),
          this.formatArn({
            service: "ssm",
            account: "",
            resource: "document",
            resourceName: "AWS-RunShellScript",
          }),
        ],
      }),
    );
    // These two take no resource; they only read the results of commands.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"],
        resources: ["*"],
      }),
    );
    new CfnOutput(this, "DeployRoleArn", { value: role.roleArn });
  }
}

// First boot: Docker with Compose v2, the AWS CLI (backups, artifacts), git, 2 GB of swap, and the
// repository in /home/ubuntu/commerce. The rest (.env.prod, images, start) is docs/deploy.md.
const USER_DATA = `#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 git
snap install aws-cli --classic
usermod -aG docker ubuntu
systemctl enable --now docker
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
if [ ! -d /home/ubuntu/commerce ]; then
  sudo -u ubuntu git clone https://github.com/nyambayar1231/commerce.git /home/ubuntu/commerce
fi
`;
