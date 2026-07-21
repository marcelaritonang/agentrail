"use client";

import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatCost,
  formatDuration,
  formatTimestamp,
  shortId,
} from "../lib/format";
import type { TraceSpan } from "../lib/trace-read-model";
import { EvidenceContent, type EvidenceViewState } from "./evidence-content";

type EvidenceResponse = {
  state: "available" | "redacted";
  truncated: boolean;
  payload: unknown;
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

function originFor(spanId: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-span-id]")).find(
      (element) => element.dataset.spanId === spanId,
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
  const [evidence, setEvidence] = useState<EvidenceViewState>({
    status: "loading",
  });
  const closeHref = `/traces/${encodeURIComponent(traceId)}`;

  const close = useCallback(() => {
    const origin = originFor(span.spanId);
    router.push(closeHref);
    origin?.focus();
  }, [closeHref, router, span.spanId]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!span.hasPayload) {
      setEvidence({ status: "none" });
      return;
    }

    const controller = new AbortController();
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
      .then((state) => setEvidence(state))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setEvidence({ status: "error" });
        }
      });

    return () => controller.abort();
  }, [span.hasPayload, span.spanId, traceId]);

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
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
        aria-label={`Evidence for ${span.name}`}
        aria-describedby="evidence-description"
        tabIndex={-1}
        onKeyDown={containFocus}
      >
        <header className="evidence-drawer-header">
          <div>
            <span>Span evidence / {shortId(span.spanId)}</span>
            <h2 id="evidence-title">{span.name}</h2>
            <p id="evidence-description">
              Payload resolved through the scoped AgentRail backend.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close evidence"
          >
            <X aria-hidden="true" size={17} weight="regular" />
          </button>
        </header>

        <dl className="evidence-facts">
          <div>
            <dt>Kind</dt>
            <dd>{span.kind}</dd>
          </div>
          <div>
            <dt>Actor</dt>
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
          <div>
            <dt>Cost</dt>
            <dd className={span.pricingUnknown ? "cost-unpriced" : undefined}>
              {formatCost({
                totalCostUsd: span.costUsd,
                pricingUnknown: span.pricingUnknown,
              })}
            </dd>
          </div>
        </dl>

        <section className="evidence-body" aria-labelledby="payload-title">
          <div className="evidence-body-heading">
            <h3 id="payload-title">Captured payload</h3>
            <span>JSON / private no-store</span>
          </div>
          <EvidenceContent state={evidence} />
        </section>
      </aside>
    </div>
  );
}
