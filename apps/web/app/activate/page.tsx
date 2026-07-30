import type { Metadata } from "next";

import { ActivationForm } from "../../components/activation-form";
import { PublicSiteShell } from "../../components/public-site-shell";

export const metadata: Metadata = {
  title: "Activate a local agent - AgentRail",
  description:
    "Approve a local Codex or Claude-style AgentRail installation with a short device code.",
};

export default async function ActivatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const codeParam = params?.code;
  const initialCode = Array.isArray(codeParam) ? codeParam[0] : codeParam;

  return (
    <PublicSiteShell>
      <main className="auth-page">
        <div className="auth-copy">
          <span className="page-eyebrow">Device approval</span>
          <h1>Approve AgentRail on this machine</h1>
          <p>
            This is the browser side of AgentRail hosted activation. It binds a
            local CLI or MCP installation to your project without exposing raw
            project credentials in the page URL.
          </p>
        </div>
        <ActivationForm initialCode={initialCode ?? ""} />
      </main>
    </PublicSiteShell>
  );
}
