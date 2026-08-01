# AgentRail AWS Hosted Control Plane

This document describes the optional hosted backend for AgentRail activation and
metrics ingestion. The open-source Context Relay still works offline; this stack
only powers GitHub activation, metrics-only event ingestion, queues, workers,
private storage, alarms, and founder analytics inputs.

## Before deploy prerequisites

- AWS account on Paid Tier with billing alerts enabled.
- AWS Budget subscriber email confirmed. The SAM template also creates
  `BetaMonthlyBudget`, but the email confirmation must be completed before any
  founding-user traffic.
- Private VPC subnets for Lambda and RDS, plus security groups that allow Lambda
  egress to PostgreSQL and AWS service endpoints.
- Secrets Manager entries:
  - `agentrail/beta/database` with `{"password":"..."}`;
  - `agentrail/beta/database-url` with `{"value":"postgresql://..."}` after
    the private RDS endpoint is known;
  - `agentrail/beta/api-key-pepper` with `{"value":"..."}`;
  - `agentrail/beta/installation-pepper` with `{"value":"..."}`;
  - `agentrail/beta/better-auth` with `{"value":"..."}`;
  - `agentrail/beta/github-client-id` with `{"value":"..."}`;
  - `agentrail/beta/github-client-secret` with `{"value":"..."}`.
- GitHub OAuth app callback URL for the web app:
  `https://agentrail.id/api/auth/callback/github`.
- Built Lambda artifacts from `apps/ingest` and `apps/worker`.

## Validate

```bash
pnpm --filter @agentrail-sdk/ingest build
pnpm --filter @agentrail-sdk/worker build
sam validate --lint --template-file infra/aws/template.yaml
```

If local SAM CLI is unavailable, run validation in the CI container or install
AWS SAM CLI before deploying. Do not treat Vitest template checks as a
replacement for `sam validate`.

## Deploy

```bash
sam deploy \
  --template-file infra/aws/template.yaml \
  --config-file infra/aws/samconfig.toml \
  --parameter-overrides file://infra/aws/parameters.example.json
```

For a real beta, copy `samconfig.toml.example` to `samconfig.toml`, replace the
placeholder subnet/security-group IDs, and point every secret parameter to an
existing Secrets Manager name.

## Database migrations

Run migrations once after the RDS instance is reachable from a trusted network
path or migration job:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @agentrail-sdk/db db:migrate
```

Do not run migrations from every Lambda cold start.

## Vercel environment

Set these server-only values on the web deployment if `agentrail.id` is serving
the versioned `/v1` endpoints through the Next.js hosted ingest bridge:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL=https://agentrail.id`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `INSTALLATION_CREDENTIAL_PEPPER`
- `API_KEY_PEPPER`
- `REDIS_URL` for the local/managed Redis span queue, or
  `AGENTRAIL_SPAN_QUEUE_URL` plus `AWS_REGION` for SQS
- `NEXT_PUBLIC_AGENTRAIL_SITE_URL=https://agentrail.id`
- `AGENTRAIL_ACTIVATION_BASE_URL=https://agentrail.id/activate`

With these values present, the production smoke expected behavior is:

- `POST https://agentrail.id/v1/device/code` returns a device code or a
  non-configuration rate-limit response.
- `POST https://agentrail.id/v1/device/token` returns a valid polling response
  for the supplied device code.
- `POST https://agentrail.id/v1/events` without a bearer installation
  credential returns `401 unauthorized`, not `503 service_unavailable`.

If a separate API Gateway domain is used instead of the Next.js bridge, point
the CLI `--api-url` and public setup copy to that API domain. Do not leave
`https://agentrail.id/v1/*` advertised as production-ready until the production
smoke passes.

Browser code must not receive database URLs, credential peppers, queue URLs, S3
bucket credentials, or credential digests.

## Operations

- CloudWatch alarms cover API 5xx, p95 latency, queue age, queue depth, DLQ
  messages, and worker errors.
- Log groups have 30-day retention.
- RDS is private, encrypted, and deletion-protected.
- S3 evidence storage blocks public access and uses server-side encryption.
- SQS uses separate span and usage queues with DLQs and redrive policies.
- Lambda reserved concurrency prevents a beta spike from exhausting account-wide
  concurrency.

## Rollback

1. Disable GitHub activation in the web app by hiding the hosted activation CTA.
2. Revoke affected installation credentials from the dashboard.
3. Roll back the SAM stack to the previous successful template version.
4. Keep RDS snapshots and S3 evidence until the incident review is complete.

## Deletion protection

Before real beta traffic, keep RDS deletion protection enabled and verify that
the founder account can receive Budget and CloudWatch alarm email. Destroying
the stack should be a separate, reviewed operation.
