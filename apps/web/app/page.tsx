import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Code,
  Database,
  GithubLogo,
  GitBranch,
  HardDrives,
} from "@phosphor-icons/react/ssr";

import { ProductMark } from "../components/product-mark";

const SOURCE_URL = "https://github.com/agentrail/agentrail";

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
    title: "Replay",
    body: "The dashboard reconstructs Trace Rail, Action Ledger, and payload evidence through backend routes.",
    icon: HardDrives,
  },
];

const quickstart = `import { AgentRail } from "@agentrail/sdk";

const rail = new AgentRail({ apiKey: process.env.AGENTRAIL_KEY });

await rail.trace(
  "sample.research-answer",
  { agent_id: "research-agent", on_behalf_of: "sample-user" },
  async (trace) => {
    await trace.llm("draft answer", { model: "claude-3-5-sonnet" });
    await trace.action("filesystem.read", { path: "notes.md" });
  },
);

await rail.shutdown();`;

export const metadata: Metadata = {
  title: "AgentRail | Flight recorder for AI agents",
  description:
    "Open-source forensic traces, cost tracking, and action evidence for AI agents.",
};

export default function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Landing navigation">
        <Link href="/" className="landing-brand" aria-label="AgentRail home">
          <ProductMark />
          <span>AgentRail</span>
        </Link>
        <div className="landing-nav-links">
          <Link href="/traces">Dashboard</Link>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
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
              Open trace dashboard
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="landing-button landing-button-secondary"
            >
              View source
              <GithubLogo size={15} aria-hidden="true" />
            </a>
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

      <section className="landing-section landing-quickstart">
        <div className="landing-quickstart-copy">
          <h2>One SDK surface</h2>
          <p>
            The M1 target stays small: trace, span, action, cost, and payload
            evidence. Enough to prove the core pipeline without pretending to be
            enterprise observability.
          </p>
        </div>
        <pre aria-label="TypeScript quickstart">
          <code>{quickstart}</code>
        </pre>
      </section>

      <section className="landing-section landing-cta">
        <div>
          <h2>Open-source first, self-hosted by default</h2>
          <p>
            Apache-2.0, local Docker, and a narrow M1 scope make the AWS startup
            application credible before the company exists.
          </p>
        </div>
        <div className="landing-actions">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="landing-button landing-button-primary"
          >
            View source
            <GithubLogo size={15} aria-hidden="true" />
          </a>
          <Link
            href="/traces"
            className="landing-button landing-button-secondary"
          >
            Inspect demo
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
