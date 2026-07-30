"use client";

import { useMemo, useState } from "react";

type ActivationState =
  | "waiting"
  | "invalid"
  | "expired"
  | "login_required"
  | "awaiting_poll"
  | "approved"
  | "already_approved"
  | "revoked"
  | "service_unavailable";

const stateCopy: Record<ActivationState, { title: string; body: string }> = {
  waiting: {
    title: "Enter the code from your terminal",
    body: "AgentRail only connects this local agent after you approve the code here.",
  },
  invalid: {
    title: "Code not recognized",
    body: "Check the 12-character code and try again. We do not reveal whether a project exists.",
  },
  expired: {
    title: "Code expired",
    body: "Run the AgentRail login command again to generate a fresh code.",
  },
  login_required: {
    title: "Sign in required",
    body: "Sign in with GitHub first, then approve the device code again.",
  },
  awaiting_poll: {
    title: "Approved. Waiting for the local agent",
    body: "Return to your terminal. The CLI will fetch its credential on the next poll.",
  },
  approved: {
    title: "Device approved",
    body: "This local agent is now allowed to send metrics for your AgentRail project.",
  },
  already_approved: {
    title: "Code already approved",
    body: "If your terminal did not finish, generate a new code and approve that one.",
  },
  revoked: {
    title: "Installation revoked",
    body: "This credential can no longer submit hosted metrics.",
  },
  service_unavailable: {
    title: "Activation temporarily unavailable",
    body: "Keep using local Context Relay and retry hosted activation later.",
  },
};

export function ActivationForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<ActivationState>("waiting");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formattedCode = useMemo(() => formatCode(code), [code]);

  async function approve() {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/activation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: formattedCode }),
      });
      const body = (await response.json()) as { status?: ActivationState };

      if (body.status === "approved") {
        setState("awaiting_poll");
      } else if (body.status !== undefined && body.status in stateCopy) {
        setState(body.status);
      } else {
        setState("service_unavailable");
      }
    } catch {
      setState("service_unavailable");
    } finally {
      setIsSubmitting(false);
    }
  }

  const copy = stateCopy[state];

  return (
    <section className="activation-panel" aria-labelledby="activation-heading">
      <div>
        <span className="page-eyebrow">Hosted activation</span>
        <h1 id="activation-heading">Connect a local AI agent</h1>
        <p>
          Use this page only when the AgentRail CLI, Codex MCP profile, or a
          Claude-style local agent asks you to approve a device code.
        </p>
      </div>
      <label className="activation-code-field">
        <span>Device code</span>
        <input
          autoCapitalize="characters"
          autoComplete="one-time-code"
          inputMode="text"
          maxLength={14}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABCD-EFGH-JKLM"
          value={formattedCode}
        />
      </label>
      <button
        className="activation-submit"
        disabled={isSubmitting || formattedCode.length < 14}
        onClick={() => void approve()}
        type="button"
      >
        {isSubmitting ? "Approving..." : "Approve this device"}
      </button>
      <div
        className={`activation-state activation-state-${state}`}
        role="status"
      >
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
      </div>
    </section>
  );
}

function formatCode(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
  const groups = normalized.match(/.{1,4}/g) ?? [];
  return groups.join("-");
}
