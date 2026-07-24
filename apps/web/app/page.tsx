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

const setupQuickstart = `npm install @agentrail/sdk

# MCP reader for Codex-style tools
npx @agentrail/mcp`;

const sdkQuickstart = `import { AgentRail, BufferedDelivery, HttpSpanTransport } from "@agentrail/sdk";

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

      <section id="quickstart" className="landing-section landing-quickstart">
        <div className="landing-quickstart-copy">
          <h2>NPM quickstart</h2>
          <p>
            Users should not need a monorepo checkout just to instrument an
            agent. The public path is one SDK install, while source checkout and
            Docker remain for maintainers and self-hosting.
          </p>
        </div>
        <div className="landing-code-stack">
          <pre aria-label="NPM install quickstart">
            <code>{setupQuickstart}</code>
          </pre>
          <pre aria-label="TypeScript SDK example">
            <code>{sdkQuickstart}</code>
          </pre>
        </div>
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
