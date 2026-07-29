# AgentRail Evidence Register

Every application claim must map to evidence. Status values are limited to
`verified`, `pending`, and `not-applicable`.

| Claim                                         | Evidence                                                                     | Status         | Owner   |
| --------------------------------------------- | ---------------------------------------------------------------------------- | -------------- | ------- |
| AgentRail has a functioning website.          | `https://agentrail.id`, `/robots.txt`, `/sitemap.xml`, public trust pages    | verified       | Founder |
| AgentRail publishes an SDK package.           | `npm view @agentrail-sdk/sdk version`                                        | verified       | Founder |
| AgentRail publishes an MCP package.           | `npm view @agentrail-sdk/mcp version`                                        | verified       | Founder |
| AgentRail has a local-first M1 dashboard.     | `/traces` guided demo with synthetic trace data                              | verified       | Founder |
| AgentRail has public security/legal surfaces. | `/privacy`, `/security`, `/terms`                                            | verified       | Founder |
| Founding-tester intake exists.                | `.github/ISSUE_TEMPLATE/founding-tester.yml` and `/founding-testers`         | verified       | Founder |
| Founding-tester results exist.                | Interview records are not collected yet.                                     | pending        | Founder |
| Context Relay is implemented end to end.      | Design exists; implementation is next milestone.                             | pending        | Founder |
| AWS deployment exists.                        | AWS docs are reference mapping only.                                         | not-applicable | Founder |
| AWS acceptance or credit award exists.        | No acceptance or award is claimed.                                           | not-applicable | Founder |
| Production HTTP verifier exists.              | `scripts/verify-production.ts` and `tests/smoke/production-contract.test.ts` | verified       | Founder |
| Registry smoke workflow has run on GitHub.    | Add a real workflow run URL after `registry-smoke.yml` completes.            | pending        | Founder |

## Verification commands

Use these before updating a `pending` item to `verified`:

```powershell
rtk npm view @agentrail-sdk/sdk version
rtk npm view @agentrail-sdk/mcp version
rtk pnpm test:npm:registry
rtk playwright test tests/e2e/landing.spec.ts --project=desktop
rtk pnpm --filter @agentrail-sdk/web build
```
