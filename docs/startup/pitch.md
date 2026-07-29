# AgentRail startup pitch

AgentRail is an open-source flight recorder for AI agents. It records traces, tool actions, model cost metadata, actor attribution, and evidence payload status so developers can debug and audit autonomous AI workflows after they act. AWS credits would be used to move the local Docker demo toward an AWS-native reference deployment with API Gateway, Lambda, SQS, RDS/PostgreSQL, S3, CloudWatch, and future Amazon Bedrock cost and audit integrations.

## Current ask

The immediate milestone is not a hosted enterprise product. The current ask is infrastructure support for a credible open-source developer tool: package release hardening, AWS reference deployment, tester feedback, and documentation that makes AI agent audits reproducible.

AWS Activate acceptance is not guaranteed. The application should use the
evidence-linked pack in `docs/startup/aws-activate-application.md` and leave
tester, deployment, revenue, and funding fields pending until evidence exists.

## Proof points

- Working public website and guided dashboard demo.
- Public GitHub repository with implemented M1 ingestion, worker, SDK, MCP, and dashboard components.
- Clear AWS usage path across ingestion, queueing, storage, observability, and Bedrock metadata.
- Apache-2.0 license and open-source-first positioning.

## Application pack

- AWS application draft: `docs/startup/aws-activate-application.md`
- 90-day credit plan: `docs/startup/aws-90-day-credit-plan.md`
- Evidence register: `docs/startup/evidence-register.md`
- Readiness checklist: `docs/startup/application-readiness-checklist.md`
