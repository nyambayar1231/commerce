// The CDK app (PLAN M10.5): `pnpm --filter @commerce/infra-aws cdk <synth|diff|deploy> --profile commerce`.
// Everything lives in ap-northeast-2 (Seoul), the owner's rule.
import { App } from "aws-cdk-lib";
import { CommerceStack } from "../lib/commerceStack.ts";

const app = new App();
new CommerceStack(app, "Commerce", {
  // The account comes from the CLI profile (`--profile commerce`), so none is committed.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "ap-northeast-2" },
  description:
    "commerce: one EC2 instance running docker-compose.prod.yml, its S3 buckets and role",
  // Its main branch deploys through GitHub Actions (PLAN M12).
  githubRepository: "nyambayar1231/commerce",
});
