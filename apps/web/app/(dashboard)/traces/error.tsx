"use client";

import { WarningCircle } from "@phosphor-icons/react";

export default function TracesError({ reset }: { reset: () => void }) {
  return (
    <section className="trace-error" aria-labelledby="trace-error-title">
      <WarningCircle aria-hidden="true" size={22} weight="regular" />
      <div>
        <h1 id="trace-error-title">Trace archive unavailable</h1>
        <p>The project-scoped read failed. Verify PostgreSQL, then retry this view.</p>
      </div>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
