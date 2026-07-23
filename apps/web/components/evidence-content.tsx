import { Info, Warning } from "@phosphor-icons/react";

export type EvidenceViewState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "error" }
  | {
      status: "ready";
      captureState: "available" | "redacted";
      truncated: boolean;
      payload: unknown;
    };

export function EvidenceContent({ state }: { state: EvidenceViewState }) {
  if (state.status === "loading") {
    return (
      <div className="evidence-loading" aria-busy="true">
        <span>Loading recorded data…</span>
        <i />
        <i />
        <i />
      </div>
    );
  }

  if (state.status === "none") {
    return (
      <div className="evidence-message">
        <Info aria-hidden="true" size={17} weight="regular" />
        <div>
          <strong>No input/output was captured for this step.</strong>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="evidence-message evidence-message-error">
        <Warning aria-hidden="true" size={17} weight="regular" />
        <div>
          <strong>Recorded data couldn&apos;t be loaded.</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="evidence-payload">
      {state.captureState === "redacted" ? (
        <div className="evidence-notice">
          <Info aria-hidden="true" size={15} weight="regular" />
          <span>Sensitive fields were removed before storage.</span>
        </div>
      ) : null}
      {state.truncated ? (
        <div className="evidence-notice evidence-notice-warning">
          <Warning aria-hidden="true" size={15} weight="regular" />
          <span>
            Recorded data was shortened at the configured capture limit.
          </span>
        </div>
      ) : null}
      <pre aria-label="Captured payload JSON">
        <code>{JSON.stringify(state.payload, null, 2)}</code>
      </pre>
    </div>
  );
}
