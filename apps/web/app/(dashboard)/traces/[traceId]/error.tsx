"use client";

import { WarningCircle } from "@phosphor-icons/react";

export default function TraceDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="trace-error" aria-labelledby="trace-detail-error-title">
      <WarningCircle aria-hidden="true" size={22} weight="regular" />
      <div>
        <h1 id="trace-detail-error-title">
          We couldn&apos;t load this agent run
        </h1>
        <p>Try the request again. Your recorded data has not been changed.</p>
        <details>
          <summary>Technical details</summary>
          <p>The run detail read request failed.</p>
        </details>
      </div>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
