import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";

import { PublicSiteShell } from "../../components/public-site-shell";
import { readPublicAgentRailConfig } from "../../lib/public-config";

export const metadata: Metadata = {
  title: "AgentRail Founding Testers",
  description:
    "Founding tester intake for developers evaluating AgentRail with local AI agent workflows.",
};

const checkpoints = [
  "installation completed",
  "first Context Pack created",
  "returned within seven days",
  "uninstall reason",
] as const;

const testerFit = [
  "You use Codex, Claude, or another MCP-capable local AI workflow.",
  "You can test one repository or agent workflow without sharing private source, prompts, credentials, or payload data.",
  "You are willing to report what was useful, confusing, slow, or not worth keeping.",
] as const;

export default function FoundingTestersPage() {
  const config = readPublicAgentRailConfig();
  const intakeUrl = config.testerIntakeUrl?.href ?? null;

  return (
    <PublicSiteShell>
      <article className="public-doc">
        <h1>AgentRail Founding Testers</h1>
        <p>
          AgentRail is collecting a small evidence set from individual
          developers before hosted onboarding. The goal is to learn whether the
          SDK, MCP reader, and upcoming Context Relay help real AI workflows
          preserve useful context and forensic evidence.
        </p>

        <section>
          <h2>Who should test</h2>
          <ul>
            {testerFit.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>What we measure</h2>
          <p>
            The tester loop records practical checkpoints instead of traction
            claims. These phrases are intentionally plain so every interview can
            be compared consistently.
          </p>
          <ul className="public-checklist">
            {checkpoints.map((checkpoint) => (
              <li key={checkpoint}>{checkpoint}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Privacy boundary</h2>
          <p>
            Do not share source code, private prompts, credentials, API keys, or
            proprietary payloads. Feedback should describe workflow category,
            install outcome, context quality, latency perception, and whether
            you would keep or uninstall AgentRail.
          </p>
        </section>

        <section className="public-action-panel">
          <h2>Apply to test</h2>
          <p>
            Public intake is controlled by{" "}
            <code>NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL</code>. If it is not
            configured, AgentRail shows an honest unavailable state instead of a
            dead button or fake form.
          </p>
          {intakeUrl === null ? (
            <p role="status">
              Tester intake is being prepared. Use the About page for current
              project status until the public issue form is configured.
            </p>
          ) : (
            <a
              href={intakeUrl}
              target="_blank"
              rel="noreferrer"
              className="landing-button landing-button-primary"
            >
              Open tester intake
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          )}
        </section>

        <section>
          <h2>Before applying</h2>
          <p>
            Review the guided sample first. It explains the Trace Rail, Evidence
            Drawer, and Action Ledger using synthetic data only.
          </p>
          <Link href="/traces" className="landing-inline-link">
            Open guided sample
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
      </article>
    </PublicSiteShell>
  );
}
