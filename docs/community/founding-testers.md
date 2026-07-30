# AgentRail founding tester plan

AgentRail needs three founding testers before the next milestone. The goal is to validate whether real developers understand the product, can run the local demo, and can identify one AI agent workflow where trace and action evidence would help.

## Target tester profiles

1. AI agent application developer building with tool calls, retrieval, or multi-step workflows.
2. Internal automation team using AI to run operational or research tasks.
3. Open-source maintainer using Codex, Claude-style tools, or an MCP-capable local workflow.

## Feedback tasks

Ask each tester to complete the same four tasks:

1. Open the public guided demo and explain what the Trace Rail, Evidence Drawer, and Action Ledger are for.
2. Try either `npm install @agentrail-sdk/sdk`, `npm install -D @agentrail-sdk/cli`, `npx -y @agentrail-sdk/mcp`, or the local source quickstart, then identify the first command or concept that feels unclear.
3. Run `npx -y @agentrail-sdk/cli context --root . --task "Audit this change" --token-budget 4000 --json` on a safe test repository and confirm whether the returned Context Pack is useful.
4. Describe one workflow where AgentRail should record traces, actions, cost, context, and evidence status.

## Outreach message

Subject: founding tester request for AgentRail

I am building AgentRail, an open-source flight recorder for AI agents. It records traces, tool actions, model cost metadata, actor attribution, local Context Packs, and evidence payload status so developers can debug and audit autonomous AI workflows. I am looking for three founding testers who can review the demo, try `npm install @agentrail-sdk/sdk`, `npm install -D @agentrail-sdk/cli`, or `npx -y @agentrail-sdk/mcp` if relevant, and give blunt feedback on whether this would help with real agent debugging. The demo and source are public at https://agentrail.id and https://github.com/marcelaritonang/agentrail.

## Success criteria

- Three tester conversations or issue comments.
- At least one concrete workflow proposed by each tester.
- At least five product or documentation improvements captured as GitHub issues.
- One decision on whether the next milestone should prioritize hosted onboarding, recorder integrations, client setup hardening, or AWS reference deployment.

## Intake checklist

Each tester report should capture:

- installation completed
- first Context Pack created
- returned within seven days
- uninstall reason

Do not fill traction fields from assumptions. If a tester cannot run the
Context CLI, record the exact blocker instead of treating the tester as
successful.

## Public intake

The website exposes `/founding-testers`. The call to action is controlled by the
validated `NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL` environment variable. When
that value is missing, the page must say the intake is being prepared rather
than showing a dead button.

Use `.github/ISSUE_TEMPLATE/founding-tester.yml` for GitHub issue intake and
`docs/community/founding-tester-interview.md` for structured follow-up.
