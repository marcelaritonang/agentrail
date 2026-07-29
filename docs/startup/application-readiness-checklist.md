# AgentRail Application Readiness Checklist

Use this checklist immediately before submitting an AWS Activate Founders
application. It is intentionally conservative: unresolved items should remain
pending rather than being turned into claims.

## Identity consistency

- [ ] AWS Paid Tier account is active.
- [ ] AWS Builder ID uses the same founder/startup identity as the application.
- [ ] The company website `agentrail.id` is live and resolves over HTTPS.
- [ ] GitHub repository URL is public or intentionally configured as pending.
- [ ] npm scope `@agentrail-sdk` is owned by the applicant account.
- [ ] Website, GitHub, npm scope, and AWS account use consistent product naming.

## Product evidence

- [ ] Landing page explains what AgentRail does without AWS acceptance claims.
- [ ] `/traces` guided demo works with synthetic data.
- [ ] `/founding-testers` exposes a working intake link or honest unavailable
      state.
- [ ] README install command uses `npm install @agentrail-sdk/sdk`.
- [ ] MCP setup uses `npx -y @agentrail-sdk/mcp`.
- [ ] Security, privacy, terms, architecture, and AWS reference docs are linked.

## Application content

- [ ] Problem, Solution, Target user, Why AWS, and 90-day plan are complete.
- [ ] Evidence table uses only `verified`, `pending`, and `not-applicable`.
- [ ] No claim says acceptance, credits, revenue, production deployment, or
      tester outcomes exist before evidence exists.
- [ ] Budget plan includes CloudWatch and AWS Budgets before beta traffic.
- [ ] Founding-tester outcomes are attached only after permission to use
      anonymized aggregate feedback.
