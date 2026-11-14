import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CommerceStack, UBUNTU_AMI } from "../lib/commerceStack.ts";

// The synthesized CloudFormation template (PLAN M10.5): the properties the deployment relies on.
const template = Template.fromStack(
  new CommerceStack(new App(), "Commerce", {
    env: { account: "123456789012", region: "ap-northeast-2" },
  }),
);

describe("CommerceStack", () => {
  it("opens only HTTP and HTTPS, no SSH", () => {
    const groups = template.findResources("AWS::EC2::SecurityGroup");
    const ingress = Object.values(groups).flatMap(
      (group) =>
        (group.Properties.SecurityGroupIngress ?? []) as {
          IpProtocol: string;
          FromPort: number;
        }[],
    );
    expect(ingress.map((rule) => `${rule.IpProtocol}/${rule.FromPort}`).sort()).toEqual([
      "tcp/443",
      "tcp/80",
      "udp/443",
    ]);
  });

  it("runs a pinned Ubuntu arm64 t4g.small with IMDSv2 reachable from containers", () => {
    template.hasResourceProperties("AWS::EC2::Instance", {
      ImageId: UBUNTU_AMI,
      InstanceType: "t4g.small",
      MetadataOptions: { HttpTokens: "required", HttpPutResponseHopLimit: 2 },
      BlockDeviceMappings: [
        Match.objectLike({ Ebs: Match.objectLike({ VolumeSize: 30, Encrypted: true }) }),
      ],
    });
    template.resourceCountIs("AWS::EC2::EIP", 1);
    template.resourceCountIs("AWS::EC2::NatGateway", 0);
  });

  it("lets the instance use Session Manager", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      ManagedPolicyArns: Match.arrayWith([
        Match.objectLike({
          "Fn::Join": Match.arrayWith([
            Match.arrayWith([":iam::aws:policy/AmazonSSMManagedInstanceCore"]),
          ]),
        }),
      ]),
    });
  });

  it("makes media objects public through a policy, never ACLs", () => {
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "s3:GetObject", Effect: "Allow", Principal: { AWS: "*" } }),
        ]),
      },
    });
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    });
  });

  it("keeps backups private for 30 days and artifacts for 7", () => {
    for (const days of [30, 7]) {
      template.hasResourceProperties("AWS::S3::Bucket", {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        LifecycleConfiguration: {
          Rules: [Match.objectLike({ ExpirationInDays: days, Status: "Enabled" })],
        },
      });
    }
  });

  it("keeps the media and backup buckets when the stack is deleted", () => {
    const retained = Object.values(template.findResources("AWS::S3::Bucket")).filter(
      (bucket) => bucket.DeletionPolicy === "Retain",
    );
    expect(retained).toHaveLength(2);
  });
});

describe("the GitHub deploy role (PLAN M12)", () => {
  const withDeploy = Template.fromStack(
    new CommerceStack(new App(), "Commerce", {
      env: { account: "123456789012", region: "ap-northeast-2" },
      githubRepository: "owner/repo",
    }),
  );

  it("trusts only the repository's main branch through GitHub's OIDC provider", () => {
    withDeploy.hasResourceProperties("AWS::IAM::OIDCProvider", {
      Url: "https://token.actions.githubusercontent.com",
      ClientIdList: ["sts.amazonaws.com"],
    });
    withDeploy.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                "token.actions.githubusercontent.com:sub": "repo:owner/repo:ref:refs/heads/main",
              },
            },
          }),
        ],
      },
    });
  });

  it("may only upload images and run a command on the instance", () => {
    const policies = withDeploy.findResources("AWS::IAM::Policy", {
      Properties: { PolicyName: Match.stringLikeRegexp("^Deploy") },
    });
    const actions = Object.values(policies)
      .flatMap((policy) => policy.Properties.PolicyDocument.Statement)
      .flatMap((statement: { Action: string | string[] }) => [statement.Action].flat())
      .sort();
    expect(actions).toEqual([
      "s3:Abort*",
      "s3:PutObject",
      "s3:PutObjectLegalHold",
      "s3:PutObjectRetention",
      "s3:PutObjectTagging",
      "s3:PutObjectVersionTagging",
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:SendCommand",
    ]);
  });

  it("is absent without a repository", () => {
    template.resourceCountIs("AWS::IAM::OIDCProvider", 0);
  });
});
