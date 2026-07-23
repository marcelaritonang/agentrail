"use client";

import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  formatCost,
  formatDuration,
  formatTimestamp,
  shortId,
} from "../lib/format";
import type { TraceSpan } from "../lib/trace-read-model";
import { humanizeName } from "../lib/trace-presentation";
import { EvidenceContent, type EvidenceViewState } from "./evidence-content";

type EvidenceResponse = {
  state: "available" | "redacted";
  truncated: boolean;
  payload: unknown;
};

type KeyedEvidenceState = {
  key: string;
  view: EvidenceViewState;
};

function isEvidenceResponse(value: unknown): value is EvidenceResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EvidenceResponse>;
  return (
    (candidate.state === "available" || candidate.state === "redacted") &&
    typeof candidate.truncated === "boolean" &&
    "payload" in candidate
  );
}

function durationOf(span: TraceSpan): number {
  return Date.parse(span.endedAt) - Date.parse(span.startedAt);
}

const plainKind: Record<TraceSpan["kind"], string> = {
  trace: "Recorded the complete run",
  retrieval: "Looked up data",
  llm: "Called an AI model",
  action: "Performed an external action",
  tool: "Called a tool",
  custom: "Recorded a custom step",
};

function firstConnectedOrigin(spanId: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-span-id]")).find(
      (element) => element.dataset.spanId === spanId && element.isConnected,
    ) ?? null
  );
}

export function EvidenceDrawer({
  traceId,
  span,
}: {
  traceId: string;
  span: TraceSpan;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activeOriginRef = useRef<HTMLElement | null>(null);
  const evidenceKey = `${traceId}\u0000${span.spanId}`;
  const [storedEvidence, setStoredEvidence] = useState<KeyedEvidenceState>({
    key: evidenceKey,
    view: { status: "loading" },
  });
  const evidence: EvidenceViewState =
    storedEvidence.key === evidenceKey
      ? storedEvidence.view
      : { status: "loading" };
  const closeHref = `/traces/${encodeURIComponent(traceId)}`;

  const close = useCallback(() => {
    router.push(closeHref);
    const activeOrigin = activeOriginRef.current;
    if (activeOrigin?.isConnected) {
      activeOrigin.focus();
      return;
    }
    firstConnectedOrigin(span.spanId)?.focus();
  }, [closeHref, router, span.spanId]);

  useLayoutEffect(() => {
    activeOriginRef.current = null;
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.dataset.spanId === span.spanId &&
      (activeElement.dataset.evidenceOrigin === "steps" ||
        activeElement.dataset.evidenceOrigin === "timeline" ||
        activeElement.dataset.evidenceOrigin === "actions")
    ) {
      activeOriginRef.current = activeElement;
    }
    closeRef.current?.focus();
  }, [span.spanId, traceId]);

  useEffect(() => {
    if (!span.hasPayload) {
      setStoredEvidence({
        key: evidenceKey,
        view: { status: "none" },
      });
      return;
    }

    const controller = new AbortController();
    setStoredEvidence({
      key: evidenceKey,
      view: { status: "loading" },
    });
    const endpoint = `/api/traces/${encodeURIComponent(traceId)}/payload/${encodeURIComponent(
      span.spanId,
    )}`;

    void fetch(endpoint, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 204) return { status: "none" } as const;
        if (!response.ok) return { status: "error" } as const;
        const body: unknown = await response.json();
        if (!isEvidenceResponse(body)) return { status: "error" } as const;
        return {
          status: "ready",
          captureState: body.state,
          truncated: body.truncated,
          payload: body.payload,
        } as const;
      })
      .then((view) => {
        if (!controller.signal.aborted) {
          setStoredEvidence({ key: evidenceKey, view });
        }
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setStoredEvidence({
            key: evidenceKey,
            view: { status: "error" },
          });
        }
      });

    return () => controller.abort();
  }, [evidenceKey, span.hasPayload, span.spanId, traceId]);

  function containFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (panel === null) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (focusable.length === 1) {
      event.preventDefault();
      first?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div
      className="evidence-drawer-shell"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <aside
        ref={panelRef}
        className="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Recorded data for ${span.name}`}
        aria-describedby="evidence-description"
        tabIndex={-1}
        onKeyDown={containFocus}
      >
        <header className="evidence-drawer-header">
          <div>
            <span>Evidence · Span {shortId(span.spanId)}</span>
            <h2 id="evidence-title">
              {humanizeName(span.name, "Recorded step")}
            </h2>
            <p id="evidence-description">
              Input and output captured by the project-scoped AgentRail backend.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close recorded data"
          >
            <X aria-hidden="true" size={17} weight="regular" />
          </button>
        </header>

        <dl className="evidence-facts">
          <div>
            <dt>Kind</dt>
            <dd>{plainKind[span.kind]}</dd>
          </div>
          <div>
            <dt>Technical kind</dt>
            <dd>{span.kind.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd>{span.agentId}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{formatTimestamp(span.startedAt)}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{formatDuration(durationOf(span))}</dd>
          </div>
          {span.model === null ? null : (
            <div>
              <dt>Model</dt>
              <dd>{span.model}</dd>
            </div>
          )}
          {span.inputTokens === null ? null : (
            <div>
              <dt>Input tokens</dt>
              <dd>{span.inputTokens.toLocaleString("en-US")}</dd>
            </div>
          )}
          {span.outputTokens === null ? null : (
            <div>
              <dt>Output tokens</dt>
              <dd>{span.outputTokens.toLocaleString("en-US")}</dd>
            </div>
          )}
          {span.costUsd === null && !span.pricingUnknown ? null : (
            <div>
              <dt>Model cost</dt>
              <dd className={span.pricingUnknown ? "cost-unpriced" : undefined}>
                {formatCost({
                  totalCostUsd: span.costUsd,
                  pricingUnknown: span.pricingUnknown,
                })}
              </dd>
            </div>
          )}
        </dl>

        <details className="advanced-metadata">
          <summary>Advanced metadata</summary>
          <pre aria-label="Raw span attributes">
            <code>{JSON.stringify(span.attributes, null, 2)}</code>
          </pre>
        </details>

        <section className="evidence-body" aria-labelledby="payload-title">
          <div className="evidence-body-heading">
            <h3 id="payload-title">Recorded input/output</h3>
            <span>JSON / private no-store</span>
          </div>
          <EvidenceContent state={evidence} />
        </section>
      </aside>
    </div>
  );
}
