# AWS Activate Founders Application Pack

This is an internal evidence-linked application draft for AgentRail. It is not
marketing copy and does not guarantee acceptance into AWS Activate Founders.
Before submission, verify the current AWS Activate requirements and make sure
the AWS account, company identity, website, npm scope, and GitHub repository use
consistent details.

## One-sentence description

AgentRail is an open-source flight recorder for AI agents that helps individual
developers inspect traces, tool actions, evidence status, actor attribution, and
model cost metadata from local AI workflows.

| Claim                                                | Evidence                                                                                                  | Status         | Owner   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- | ------- |
| AgentRail has a functioning public website.          | `https://agentrail.id`, `/about`, `/architecture`, `/privacy`, `/security`, `/terms`, `/founding-testers` | verified       | Founder |
| AgentRail is not claiming AWS acceptance or credits. | This application pack and `docs/deployment/aws.md`                                                        | verified       | Founder |
| Institutional backing is not being claimed.          | No provider, VC, accelerator, or portfolio Org ID is included.                                            | not-applicable | Founder |
| Founding-tester evidence is still being collected.   | `.github/ISSUE_TEMPLATE/founding-tester.yml` and `docs/community/founding-testers.md`                     | pending        | Founder |

## Problem

Individual developers are increasingly using Codex, Claude-style local agents,
and TypeScript AI applications to perform multi-step work. When those agents
call tools, retrieve context, or spend model tokens, the important evidence is
often scattered across terminal logs, chat history, code edits, and temporary
files. After the run finishes, it becomes hard to answer what happened, which
source influenced the output, which action was performed, and what the model
spend was.

## Solution

AgentRail records an evidence trail around AI agent work:

- TypeScript SDK for application-level trace, span, and action recording.
- ingestion API with fast `202 Accepted` enqueue semantics.
- worker-side cost calculation from a shared pricing catalog.
- dashboard views for Trace Rail, Evidence Drawer, and Action Ledger.
- read-only MCP package for Codex-style inspection of recorded traces.
- local Context Relay packages for bounded source packs before AI coding runs.

## Current verified product

The current product is an open-source, local-first M1 implementation:

- public website on `agentrail.id`;
- guided read-only dashboard demo using synthetic data;
- SDK package `@agentrail-sdk/sdk` published on npm;
- Context Relay packages `@agentrail-sdk/context` and `@agentrail-sdk/cli`
  published on npm;
- MCP package `@agentrail-sdk/mcp` published on npm;
- Apache-2.0 license;
- local Docker-oriented architecture and AWS reference mapping.

## Context Relay milestone status

Context Relay is implemented locally through `@agentrail-sdk/context` and
`@agentrail-sdk/cli`, but it is not a completed hosted feature. It lets a
developer request a bounded local Context Pack before an AI agent run, then
record local receipts for later review. The MCP Context profile is live in
`@agentrail-sdk/mcp@0.1.2` and can be started with
`npx -y @agentrail-sdk/mcp --profile context`.

| Claim                                                     | Evidence                                                                     | Status         | Owner   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------- | ------- |
| Context Relay design exists.                              | `docs/superpowers/specs/2026-07-29-agentrail-context-relay-design.md`        | verified       | Founder |
| Local Context Relay CLI implementation is complete.        | `packages/context`, `packages/cli`, and `tests/npm/release-smoke.test.ts`     | verified       | Founder |
| MCP Context profile is live on npm.                        | `npm view @agentrail-sdk/mcp version` returns `0.1.2` and `docs/operations/mcp.md` | verified  | Founder |
| Context Pack outcomes from testers exist.                 | Intake and interview loop are ready; tester responses are not collected yet. | pending        | Founder |
| Hosted multi-tenant service exists.                       | AgentRail is currently local-first and public demo only.                     | not-applicable | Founder |

## Target user

The first target user is an individual developer building or operating local AI
agent workflows:

1. Codex users who want read-only trace lookup from their local tools.
2. Claude-style MCP users who need evidence around AI actions.
3. TypeScript AI app developers who need trace, action, actor, and cost records.

The first distribution path is open source: GitHub, npm packages, technical
docs, and direct founding-tester outreach.

## Open-source and npm evidence

| Claim                                                 | Evidence                                                             | Status   | Owner   |
| ----------------------------------------------------- | -------------------------------------------------------------------- | -------- | ------- |
| SDK package is published.                             | `npm view @agentrail-sdk/sdk version` and README install section       | verified | Founder |
| Context CLI package is published.                     | `npm view @agentrail-sdk/cli version` and README install section       | verified | Founder |
| MCP package is published.                             | `npm view @agentrail-sdk/mcp version` and `docs/operations/mcp.md`     | verified | Founder |
| The unscoped `agentrail` package is not this project. | README package naming section                                          | verified | Founder |
| GitHub repository is public.                          | Source URL must be configured in `NEXT_PUBLIC_AGENTRAIL_SOURCE_URL`.   | pending  | Founder |

## Founding-tester validation plan

The next validation step is not a vanity metric. AgentRail needs three
developer testers to confirm whether the product is understandable, installable,
and useful enough to keep.

Evidence to collect:

- installation completed;
- first Context Pack created or exact blocker recorded;
- returned within seven days;
- uninstall reason;
- one concrete workflow category per tester;
- one decision on whether to prioritize hosted onboarding, recorder
  integrations, or AWS reference deployment.

## Why AWS

AWS is technically relevant because AgentRail's production path requires
bounded ingestion, asynchronous processing, private relational state, optional
evidence object storage, secret handling, and operational alarms. The local
adapters already map to AWS services without changing the product contract:

- API Gateway and Lambda for authenticated ingestion.
- SQS and Lambda worker for async processing.
- RDS PostgreSQL for trace and project state.
- S3 only for opt-in evidence payload blobs.
- Secrets Manager for API key pepper and credentials.
- CloudWatch and AWS Budgets before beta traffic.
- Future Amazon Bedrock pricing metadata experiments.

## 90-day plan

See `docs/startup/aws-90-day-credit-plan.md` for the detailed service and spend
plan.

Summary:

1. Days 1-30: deploy a non-production AWS reference stack with budgets and
   alarms.
2. Days 31-60: connect limited founding-tester traffic and measure ingestion,
   queue, worker, and storage behavior.
3. Days 61-90: harden retention, failure recovery, dashboards, and cost
   reporting before deciding whether hosted beta is justified.

## Risks and mitigations

| Risk                                                        | Mitigation                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Developers do not want to instrument AI workflows manually. | Lead with Context CLI and MCP Context profile today, then harden client setup and tester onboarding.          |
| Sensitive evidence should not leave the developer machine.  | Keep local-first default, make S3 evidence opt-in, and never give browser direct bucket access.                 |
| AWS costs grow before validation.                           | Use AWS Budgets, CloudWatch alarms, reserved concurrency, lifecycle policies, and a small non-production stack. |
| Application reviewers see unsupported traction claims.      | Keep traction fields pending until evidence exists.                                                             |

## Truthful traction fields

| Field                         | Current value         | Status         |
| ----------------------------- | --------------------- | -------------- |
| Paying users                  | 0                     | pending        |
| Founding testers completed    | 0                     | pending        |
| Public npm packages           | SDK, Context CLI, and MCP reader available | verified       |
| AWS deployed production stack | Not deployed          | not-applicable |
| Funding received              | None claimed          | not-applicable |

## Account and identity checklist

- AWS Paid Tier account is created and owned by the applicant.
- Builder ID uses a professional email that matches the startup identity.
- Company/startup name, founder name, website, GitHub, and npm scope are
  consistent.
- Website is fully functioning before application submission.
- The application does not state unsupported user, revenue, funding, or AWS
  deployment claims.

## Official AWS references to verify before submission

- AWS Activate credits overview:
  <https://aws.amazon.com/startups/credits/>
- AWS step-by-step Activate application guide:
  <https://aws.amazon.com/aws-startups/learn/applying-for-aws-activate-credits-a-step-by-step-guide/>
- AWS Activate terms:
  <https://aws.amazon.com/activate/terms/>
