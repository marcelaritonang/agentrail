import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Code,
  Database,
  GitBranch,
  HardDrives,
} from "@phosphor-icons/react/ssr";

import { ProductMark } from "../components/product-mark";
import { configuredSourceUrl } from "../lib/source-url";

const flow = [
  {
    title: "Instrument",
    body: "Add the TypeScript SDK around a trace and let spans inherit actor context unless a tool overrides it.",
    icon: Code,
  },
  {
    title: "Accept",
    body: "The ingestion endpoint returns 202 only after a fast enqueue, while worker jobs handle durable processing.",
    icon: GitBranch,
  },
  {
    title: "Price",
    body: "Workers compute cost_usd from the shared catalog. Unknown model pricing stays null and explicit.",
    icon: Database,
  },
  {
    title: "Investigate",
    body: "The dashboard reconstructs Trace Rail, Action Ledger, and payload evidence through backend routes.",
    icon: HardDrives,
  },
];

const awsPlan = [
  ["Ingest", "API Gateway and Lambda accept spans with HMAC API keys."],
  ["Buffer", "SQS keeps ingestion fast while workers process traces."],
  ["Store", "RDS/PostgreSQL stores metadata and S3 stores redacted evidence."],
  ["Observe", "CloudWatch tracks queue health, worker failures, and latency."],
  [
    "Extend",
    "Amazon Bedrock cost and audit integrations fit the same model catalog path.",
  ],
] as const;

const testerProfiles = [
  "AI agent application developer",
  "internal automation team",
  "open-source maintainer using Codex or Claude-style tools",
] as const;

const npmStatus = [
  ["Available today", "Public npm packages + source checkout"],
  [
    "Published packages",
    "@agentrail-sdk/contracts@0.1.1, @agentrail-sdk/db@0.1.0, @agentrail-sdk/sdk@0.1.0, @agentrail-sdk/mcp@0.1.1",
  ],
  ["SDK path", "npm install @agentrail-sdk/sdk for TypeScript AI applications"],
  ["MCP path", "npx -y @agentrail-sdk/mcp for read-only local inspection"],
] as const;

const npmCommands = [
  {
    label: "SDK package",
    command: "npm install @agentrail-sdk/sdk",
    description: "Add AgentRail tracing to a TypeScript AI application.",
  },
  {
    label: "MCP reader",
    command: "npx -y @agentrail-sdk/mcp",
    description: "Open read-only trace lookup from Codex-style tools.",
  },
] as const;

const sdkQuickstart = `import { AgentRail, BufferedDelivery, HttpSpanTransport } from "@agentrail-sdk/sdk";

const delivery = new BufferedDelivery({
  transport: new HttpSpanTransport({
    endpoint: "http://localhost:3001/v1/spans",
    apiKey: process.env.AGENTRAIL_API_KEY!,
  }),
});

const rail = new AgentRail({
  actor: { agentId: "research-agent", onBehalfOf: "user_42" },
  sink: delivery,
});

await rail.trace({ name: "research.answer" }, async (trace) => {
  await trace.span(
    {
      kind: "llm",
      name: "draft",
      model: "test.known",
      inputTokens: 1_000,
      outputTokens: 500,
    },
    async () => undefined,
  );
  await trace.action({ name: "filesystem.read" }, async () => undefined);
});

await rail.shutdown({ timeoutMs: 5_000 });`;

export const metadata: Metadata = {
  title: "AgentRail | Flight recorder for AI agents",
  description:
    "Open-source forensic traces, cost tracking, and action evidence for AI agents.",
};

export default function LandingPage() {
  const sourceUrl = configuredSourceUrl();

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Landing navigation">
        <Link href="/" className="landing-brand" aria-label="AgentRail home">
          <ProductMark />
          <span>AgentRail</span>
        </Link>
        <div className="landing-nav-links">
          <Link href="/traces">Dashboard</Link>
          <Link href="/about">About</Link>
          <Link href="/architecture">Architecture</Link>
          {sourceUrl === null ? null : (
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              Source
            </a>
          )}
        </div>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker">
            Forensic recorder for agentic software
          </p>
          <h1 id="landing-title">AgentRail</h1>
          <p className="landing-hero-text">
            The flight recorder for AI agents. Trace decisions, tool calls,
            evidence, and spend before an agent becomes impossible to explain.
          </p>
          <div className="landing-actions">
            <Link
              href="/traces"
              className="landing-button landing-button-primary"
            >
              Explore the guided demo
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            {sourceUrl === null ? null : (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="landing-button landing-button-secondary"
              >
                View source
                <Code size={15} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        <figure className="landing-hero-shot">
          <Image
            src="/landing/agentrail-trace-rail.png"
            alt="Real Trace Rail screenshot showing the AgentRail forensic dashboard"
            width={1440}
            height={1000}
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
          />
          <figcaption>Actual seeded M1 dashboard state</figcaption>
        </figure>
      </section>

      <section className="landing-section landing-flow-section">
        <div className="landing-section-heading">
          <h2>How evidence moves</h2>
          <p>
            AgentRail keeps cost and action proof out of the SDK hot path, then
            rebuilds the run for investigation.
          </p>
        </div>

        <ol className="landing-flow" aria-label="AgentRail pipeline">
          {flow.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <span className="landing-flow-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section id="aws" className="landing-section landing-aws">
        <div className="landing-section-heading">
          <h2>Built for AWS-native deployment</h2>
          <p>
            The local M1 stack maps directly to AWS services without changing
            AgentRail&apos;s core contract.
          </p>
        </div>
        <dl className="landing-aws-grid">
          {awsPlan.map(([term, description]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <p className="landing-status-note">
          Planned AWS path: API Gateway, Lambda, SQS, RDS/PostgreSQL, S3,
          CloudWatch, and Amazon Bedrock cost metadata.
        </p>
      </section>

      <section id="quickstart" className="landing-section landing-quickstart">
        <div className="landing-quickstart-copy">
          <p className="landing-section-kicker">Published on npm</p>
          <h2>Install AgentRail with npm</h2>
          <p>
            Copy the scoped package names from here. AgentRail is published on
            npm under <code>@agentrail-sdk</code>; the unscoped{" "}
            <code>agentrail</code> package is not this project.
          </p>
          <dl className="landing-npm-status" aria-label="NPM release status">
            {npmStatus.map(([term, description]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
          <p className="landing-status-note">
            Current boundary: SDK recording and read-only MCP forensic
            inspection. Context Relay is the next verified milestone, not an
            active hosted feature.
          </p>
        </div>
        <div className="landing-code-stack">
          <section
            className="landing-npm-command-panel"
            aria-label="Highlighted npm install commands"
          >
            <div>
              <p>Live npm commands</p>
              <strong>Use these exact package names</strong>
            </div>
            <div className="landing-npm-command-list">
              {npmCommands.map((item) => (
                <div className="landing-npm-command-card" key={item.label}>
                  <span>{item.label}</span>
                  <code>{item.command}</code>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </section>
          <pre aria-label="TypeScript SDK example">
            <code>{sdkQuickstart}</code>
          </pre>
        </div>
      </section>

      <section className="landing-section landing-testers">
        <div className="landing-section-heading">
          <h2>Founding tester program</h2>
          <p>
            AgentRail needs three developer teams to test real agent workflows:
            one SDK integration, one local dashboard review, and one MCP reader
            workflow.
          </p>
        </div>
        <ul
          className="landing-tester-list"
          aria-label="Founding tester profiles"
        >
          {testerProfiles.map((profile) => (
            <li key={profile}>{profile}</li>
          ))}
        </ul>
        <Link href="/about" className="landing-inline-link">
          About and contact
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>

      <section className="landing-section landing-cta">
        <div>
          <h2>Open-source first, self-hosted by default</h2>
          <p>
            Run AgentRail locally, inspect recorded agent behavior, and keep
            sensitive evidence under your control.
          </p>
        </div>
        <div className="landing-actions">
          {sourceUrl === null ? null : (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="landing-button landing-button-primary"
            >
              View source
              <Code size={15} aria-hidden="true" />
            </a>
          )}
          <Link
            href="#quickstart"
            className="landing-button landing-button-secondary"
          >
            Review quickstart
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
