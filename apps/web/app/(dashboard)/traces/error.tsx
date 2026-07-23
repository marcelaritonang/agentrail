"use client";

import { WarningCircle } from "@phosphor-icons/react";

export default function TracesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="trace-error" aria-labelledby="trace-error-title">
      <WarningCircle aria-hidden="true" size={22} weight="regular" />
      <div>
        <h1 id="trace-error-title">We couldn't load agent runs</h1>
        <p>Try the request again. Your recorded data has not been changed.</p>
        <details>
          <summary>Technical details</summary>
          <p>The project-scoped read request failed.</p>
        </details>
      </div>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
