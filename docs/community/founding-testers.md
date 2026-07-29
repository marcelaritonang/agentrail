# AgentRail founding tester plan

AgentRail needs three founding testers before the next milestone. The goal is to validate whether real developers understand the product, can run the local demo, and can identify one AI agent workflow where trace and action evidence would help.

## Target tester profiles

1. AI agent application developer building with tool calls, retrieval, or multi-step workflows.
2. Internal automation team using AI to run operational or research tasks.
3. Open-source maintainer using Codex, Claude-style tools, or an MCP-capable local workflow.

## Feedback tasks

Ask each tester to complete the same three tasks:

1. Open the public guided demo and explain what the Trace Rail, Evidence Drawer, and Action Ledger are for.
2. Try either `npm install @agentrail-sdk/sdk`, `npx -y @agentrail-sdk/mcp`, or the local source quickstart, then identify the first command or concept that feels unclear.
3. Describe one workflow where AgentRail should record traces, actions, cost, and evidence status.

## Outreach message

Subject: founding tester request for AgentRail

I am building AgentRail, an open-source flight recorder for AI agents. It records traces, tool actions, model cost metadata, actor attribution, and evidence payload status so developers can debug and audit autonomous AI workflows. I am looking for three founding testers who can review the demo, try `npm install @agentrail-sdk/sdk` or `npx -y @agentrail-sdk/mcp` if relevant, and give blunt feedback on whether this would help with real agent debugging. The demo and source are public at https://agentrail.id and https://github.com/marcelaritonang/agentrail.

## Success criteria

- Three tester conversations or issue comments.
- At least one concrete workflow proposed by each tester.
- At least five product or documentation improvements captured as GitHub issues.
- One decision on whether the next milestone should prioritize hosted onboarding, recorder integrations, or AWS reference deployment.
