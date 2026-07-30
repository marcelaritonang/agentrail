"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { sourceQuickstartUrl } from "../lib/source-url";

const npmCommands = [
  {
    label: "SDK package",
    command: "npm install @agentrail-sdk/sdk",
    description: "Record traces from a TypeScript AI application.",
  },
  {
    label: "Context CLI",
    command: "npm install -D @agentrail-sdk/cli",
    description: "Install local Context Relay commands in a project.",
  },
  {
    label: "Create Context Pack",
    command:
      'npx -y @agentrail-sdk/cli context --root . --task "Audit this change" --token-budget 4000 --json',
    description: "Return a bounded source pack before an AI coding run.",
  },
  {
    label: "MCP trace reader",
    command: "npx -y @agentrail-sdk/mcp",
    description: "Inspect AgentRail traces from Codex-style local tools.",
  },
] as const;

export function InstallAgentRailCard({
  sourceUrl,
}: {
  sourceUrl: string | null;
}) {
  const statusId = useId();
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  async function copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
    } catch {
      setCopiedCommand("copy failed");
    }
  }

  return (
    <section
      aria-label="Install and test AgentRail"
      className="install-agentrail-card"
    >
      <div className="install-agentrail-copy">
        <span className="page-eyebrow">Open-source test path</span>
        <h2>Install and test AgentRail</h2>
        <p>
          Install the scoped npm packages or run the local stack from source.
          npm install agentrail is not this project; that unscoped npm package
          belongs to another maintainer.
        </p>
        <p id={statusId} className="install-agentrail-status" role="status">
          {copiedCommand === null ? "" : `Copied ${copiedCommand}`}
        </p>
      </div>
      <div className="install-agentrail-grid">
        <div>
          <strong>Try from source today</strong>
          <p>Clone the repository, install dependencies, then seed one run.</p>
          <pre aria-label="Source checkout commands">
            <code>{`pnpm install
pnpm bootstrap:local`}</code>
          </pre>
          {sourceUrl === null ? null : (
            <Link href={sourceQuickstartUrl(sourceUrl)}>
              Open source checkout
            </Link>
          )}
        </div>
        <div>
          <strong>Install from npm</strong>
          <p>Use the live scoped packages published under @agentrail-sdk.</p>
          <div className="install-agentrail-command-list">
            {npmCommands.map((item) => (
              <div className="install-agentrail-command" key={item.command}>
                <span>{item.label}</span>
                <code>{item.command}</code>
                <p>{item.description}</p>
                <button
                  aria-describedby={statusId}
                  aria-label={`Copy ${item.command}`}
                  onClick={() => void copyCommand(item.command)}
                  type="button"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
          <small>
            MCP Context profile 0.1.2 is source-ready but should be used through
            npx only after the registry shows 0.1.2.
          </small>
        </div>
      </div>
    </section>
  );
}
