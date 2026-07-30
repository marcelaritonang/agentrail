"use client";

import { useState } from "react";
import { ArrowClockwise, Clipboard, Trash } from "@phosphor-icons/react";

export function InstallationActions({
  installationId,
}: {
  installationId: string;
}) {
  const [credential, setCredential] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function mutate(path: string, confirm: "revoke" | "rotate") {
    setStatus("Working…");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId, confirm }),
    });
    const body = (await response.json()) as {
      status?: string;
      credential?: string;
    };
    if (!response.ok) {
      setStatus(body.status ?? "Action failed");
      return;
    }
    if (body.credential) {
      setCredential(body.credential);
    }
    setStatus(body.status ?? "Updated");
  }

  return (
    <div className="product-installation-actions">
      <button
        type="button"
        onClick={() => void mutate("/api/installations/rotate", "rotate")}
      >
        <ArrowClockwise aria-hidden="true" size={14} weight="regular" />
        Rotate
      </button>
      <button
        type="button"
        onClick={() => void mutate("/api/installations/revoke", "revoke")}
      >
        <Trash aria-hidden="true" size={14} weight="regular" />
        Revoke
      </button>
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(
            `agentrail login --api-url ${window.location.origin}`,
          )
        }
      >
        <Clipboard aria-hidden="true" size={14} weight="regular" />
        Copy setup
      </button>
      {credential ? (
        <code className="product-credential">{credential}</code>
      ) : null}
      {status ? <span role="status">{status}</span> : null}
    </div>
  );
}
