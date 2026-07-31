# AWS Reference Mapping

This document is an evidence-based **reference mapping** from the verified local architecture to AWS services. The concrete SAM reference lives in `infra/aws/template.yaml` and is described in `docs/deployment/aws-control-plane.md`. It has not yet been deployed in an AWS account and does not guarantee AWS program acceptance, credits, funding, uptime, security certification, compliance, or production readiness.

## Recommended target

| AgentRail component  | AWS target                                                    | Required work before deployment                                                   |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Next.js 16 dashboard | Amazon ECS on AWS Fargate behind an Application Load Balancer | production Dockerfile, health/readiness, TLS/domain, autoscaling, deploy pipeline |
| Hono ingestion       | Amazon API Gateway + AWS Lambda                               | Lambda adapter, payload/timeout limits, reserved concurrency, rate control        |
| Durable queue        | Amazon SQS + dead-letter queue                                | redrive policy, alarms, visibility timeout, encryption, least-privilege roles     |
| Worker               | Lambda SQS event-source mapping                               | partial batch response, retry classification, concurrency and timeout tuning      |
| PostgreSQL           | Amazon RDS for PostgreSQL, optionally RDS Proxy               | private subnets, migrations, backups, connection budget, credentials              |
| Evidence blobs       | private Amazon S3 bucket                                      | Block Public Access, encryption, lifecycle, IAM, retention policy                 |
| Secrets              | AWS Secrets Manager                                           | secret names, rotation ownership, caching strategy, IAM                           |
| Logs/metrics         | Amazon CloudWatch                                             | structured redacted logs, retention, dashboards, alarms                           |

## AWS Activate Founders boundary

The application should be framed as a request to validate an early, self-funded,
open-source developer tool. AWS's public Activate materials describe Founders as
the path for self-funded early-stage startups, with a functioning website and a
startup founded in the past 10 years. AWS also states that applications can be
accepted or rejected at its discretion, so AgentRail documentation must not
present credits as guaranteed.

Application materials live in:

- `docs/startup/aws-activate-application.md`
- `docs/startup/aws-90-day-credit-plan.md`
- `docs/startup/evidence-register.md`
- `docs/startup/application-readiness-checklist.md`

### Dashboard hosting decision

AWS Amplify Hosting documents managed SSR support through Next.js 15, while this repository's approved dashboard plan uses Next.js 16. Therefore the current recommendation is ECS/Fargate with an Application Load Balancer, which supports HTTP/HTTPS routing to Fargate services. Amplify can be reconsidered only after its documented support covers the chosen Next.js version, or after the project deliberately pins and tests a supported version.

App Runner is not the default recommendation: AWS states that it stopped accepting new customers on March 31, 2026. That makes it a poor baseline for a new Indonesian startup account in July 2026.

Official references: [Amplify Next.js support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html), [ECS/Fargate service load balancing](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-load-balancing.html), and [App Runner availability notice](https://docs.aws.amazon.com/apprunner/latest/api/API_StartDeployment.html).

## Ingestion and queue semantics

API Gateway can pass HTTP requests to Lambda through proxy integration. The Lambda handler must preserve the existing invariant: authenticate, bound and validate, add authenticated `project_id`, send one SQS message, wait for the SQS acknowledgment, then return `202`. Pricing, RDS span writes, S3 writes, and worker execution remain outside that path.

The SQS queue and Lambda worker must be in compatible Regions and use a configured event-source mapping. AWS recommends sizing SQS visibility timeout relative to Lambda timeout. Enable a dead-letter queue and `ReportBatchItemFailures`; otherwise one failed record can cause successful records in the same batch to be delivered again. AgentRail still requires database idempotency because at-least-once delivery can repeat messages.

Official references: [API Gateway Lambda proxy integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html), [SQS event-source configuration](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html), and [partial batch error handling](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html).

## Data plane

Place RDS PostgreSQL in private subnets. Lambda functions that connect to it belong in the VPC with narrowly scoped security groups. Evaluate RDS Proxy because short Lambda invocations can create frequent connections; AWS documents pooling and connection reuse as its core benefit. Run migrations as an explicit deployment job, not from every Lambda cold start.

Keep the evidence S3 bucket private and enable all Block Public Access settings. Grant `PutObject`/`GetObject` only to worker and dashboard backend roles for the required prefix. The browser receives neither bucket credentials nor direct object URLs. Choose SSE-S3 or SSE-KMS and a retention/lifecycle policy from actual data requirements rather than claiming compliance by default.

Official references: [Lambda and RDS connectivity](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/lambda-rds-connect.html), [RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html), and [S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html).

## Secrets, logs, and IAM

Store `API_KEY_PEPPER`, database credentials, and third-party provider credentials in Secrets Manager. AWS documents cached retrieval through the parameters/secrets extension or Powertools; select one after measuring cold-start and operational tradeoffs. Do not print retrieved values.

Lambda sends invocation logs to CloudWatch Logs when its execution role has the required permissions. Use structured logs containing request IDs, transport message IDs, safe error classes, durations, and counts—never bearer keys or evidence content. Set finite retention and alarms for enqueue failures, DLQ depth, worker errors, RDS connections, and unknown-pricing rate.

Official references: [Secrets Manager with Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-secrets-manager.html) and [Lambda logs in CloudWatch](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs.html).

Use separate least-privilege roles for ingestion, worker, dashboard backend, migration job, and CI deployment. No browser role receives data-plane S3 access.

## Work not yet deployed

- SAM template validation in a real AWS account
- production artifact packaging for Lambda zip bundles
- ECS dashboard image and deployment pipeline
- Secrets Manager rotation
- load, failure-injection, restore, security, and cost testing in AWS

These gaps should be shown honestly in startup materials as the next funded
milestone, alongside the locally verified core evidence.
