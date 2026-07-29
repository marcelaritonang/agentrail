# AgentRail 90-Day AWS Credit Plan

This plan assumes an AWS Activate Founders-style starting point and a small
non-production deployment. It uses ranges and assumptions rather than fabricated
spend records. Credits should be spent only after AWS Budgets and CloudWatch
alarms are in place.

## Assumptions

- One AWS account on a Paid Tier plan.
- One non-production Region.
- Three founding testers or fewer during the first validation window.
- Synthetic or opt-in evidence only.
- No production availability or compliance claim.

## Days 1-30: reference deployment

Goal: prove the local M1 architecture can run as a bounded AWS reference stack.

| Service                     | Use                                                   | Guardrail                                             |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| API Gateway                 | Public HTTPS endpoint for ingestion.                  | request size limit, throttling, access logs           |
| Lambda                      | Hono ingestion adapter and small worker functions.    | reserved concurrency and short timeout                |
| SQS                         | Durable span queue plus dead-letter queue.            | visibility timeout, redrive policy, DLQ alarm         |
| RDS PostgreSQL              | Private trace, span, action, and pricing state.       | smallest practical instance, private subnets, backups |
| S3 only for opt-in evidence | Private evidence blobs that testers explicitly allow. | Block Public Access, lifecycle, encryption            |
| Secrets Manager             | API key pepper and database credentials.              | least-privilege IAM and no secret logging             |
| CloudWatch                  | Logs, metrics, dashboards, alarms.                    | finite retention and alarm thresholds                 |
| AWS Budgets                 | Spend alarm before beta traffic.                      | monthly budget and email notification                 |

## Days 31-60: limited tester traffic

Goal: validate actual usage friction and operational behavior without expanding
scope.

- Run one SDK trace path and one MCP reader path per tester.
- Record enqueue latency, worker failures, unknown-pricing rate, and storage
  volume.
- Keep S3 writes opt-in and redacted.
- Do not enable public self-service signup.
- File product issues from tester interviews.

## Days 61-90: hardening decision

Goal: decide whether hosted beta is justified.

- Add retention controls and deletion workflow design.
- Verify restore path for RDS backup and S3 evidence lifecycle.
- Review CloudWatch dashboards and alarm noise.
- Estimate cost per active tester from measured queue, Lambda, RDS, and S3
  usage.
- Decide whether the next build should prioritize hosted onboarding, recorder
  integrations, or local Context Relay.

## Conservative spend control

No line item should scale before evidence exists. Prefer small instances,
limited concurrency, finite log retention, lifecycle expiration, and test data.
The target is learning, not traffic volume.
