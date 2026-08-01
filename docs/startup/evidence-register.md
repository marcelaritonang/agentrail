# AgentRail Evidence Register

Every application claim must map to evidence. Status values are limited to
`verified`, `pending`, and `not-applicable`.

| Claim                                              | Evidence                                                                                                                                                     | Status         | Owner   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------- |
| AgentRail has a functioning website.               | `https://agentrail.id`, `/robots.txt`, `/sitemap.xml`, public trust pages                                                                                    | verified       | Founder |
| AgentRail publishes an SDK package.                | `npm view @agentrail-sdk/sdk version`                                                                                                                        | verified       | Founder |
| AgentRail publishes Context CLI packages.          | `npm view @agentrail-sdk/context version`; `npm view @agentrail-sdk/cli version`                                                                             | verified       | Founder |
| AgentRail publishes an MCP package.                | `npm view @agentrail-sdk/mcp version`                                                                                                                        | verified       | Founder |
| AgentRail has a local-first M1 dashboard.          | `/traces` guided demo with synthetic trace data                                                                                                              | verified       | Founder |
| AgentRail has public security/legal surfaces.      | `/privacy`, `/security`, `/terms`                                                                                                                            | verified       | Founder |
| Founding-tester intake exists.                     | `.github/ISSUE_TEMPLATE/founding-tester.yml` and `/founding-testers`                                                                                         | verified       | Founder |
| Founding-tester results exist.                     | Interview records are not collected yet.                                                                                                                     | pending        | Founder |
| Context Relay CLI is implemented end to end.       | `packages/context`, `packages/cli`, and local npm smoke tests                                                                                                | verified       | Founder |
| MCP Context profile is live on npm.                | `npm view @agentrail-sdk/mcp version` returns `0.1.3` for `@agentrail-sdk/mcp`.                                                                              | verified       | Founder |
| Hosted activation pipeline is testable end to end. | `pnpm test:e2e:cloud` covers CLI activation, Redis queueing, worker aggregation, dashboard metrics, revocation, project isolation, and metrics-only privacy. | verified       | Founder |
| AWS deployment exists.                             | AWS docs are reference mapping only.                                                                                                                         | not-applicable | Founder |
| AWS acceptance or credit award exists.             | No acceptance or award is claimed.                                                                                                                           | not-applicable | Founder |
| Production HTTP verifier exists.                   | `scripts/verify-production.ts` and `tests/smoke/production-contract.test.ts`                                                                                 | verified       | Founder |
| Registry smoke workflow has run on GitHub.         | Add a real workflow run URL after `registry-smoke.yml` completes.                                                                                            | pending        | Founder |

## Verification commands

Use these before updating a `pending` item to `verified`:

```powershell
rtk npm view @agentrail-sdk/sdk version
rtk npm view @agentrail-sdk/context version
rtk npm view @agentrail-sdk/cli version
rtk npm view @agentrail-sdk/mcp version
rtk pnpm test:npm:registry
rtk playwright test tests/e2e/landing.spec.ts --project=desktop
rtk pnpm --filter @agentrail-sdk/web build
rtk pnpm test:e2e:cloud
```
