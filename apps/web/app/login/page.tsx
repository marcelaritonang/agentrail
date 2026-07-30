import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react/ssr";

import { GithubSignInButton } from "../../components/auth-actions";
import { PublicSiteShell } from "../../components/public-site-shell";

export const metadata: Metadata = {
  title: "Sign in | AgentRail",
  description:
    "Sign in to AgentRail to activate hosted metrics and manage project-scoped installations.",
};

export default function LoginPage() {
  return (
    <PublicSiteShell>
      <section className="auth-page" aria-labelledby="login-title">
        <div className="auth-copy">
          <p className="landing-section-kicker">Hosted metrics preview</p>
          <h1 id="login-title">Sign in to activate AgentRail.</h1>
          <p>
            GitHub sign-in is used only for hosted project ownership,
            installation approval, and private usage dashboards. Local Context
            Relay continues to work without an account.
          </p>
          <Link href="/architecture" className="landing-inline-link">
            Review the architecture
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className="auth-card">
          <ShieldCheck size={24} aria-hidden="true" weight="regular" />
          <h2>Project-scoped access</h2>
          <p>
            AgentRail creates one owned project for your account, then every
            device activation and installation action is checked against that
            project.
          </p>
          <GithubSignInButton />
          <p className="auth-footnote">
            No public demo data is mixed with signed-in project data.
          </p>
        </div>
      </section>
    </PublicSiteShell>
  );
}
