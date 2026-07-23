import type { CSSProperties } from "react";

import { formatDuration } from "../lib/format";
import type { TraceRailRow } from "../lib/trace-rail";

type RailStyle = CSSProperties & {
  "--rail-depth": number;
  "--rail-offset": string;
  "--rail-width": string;
};

function spanDuration(row: TraceRailRow): number {
  return Date.parse(row.span.endedAt) - Date.parse(row.span.startedAt);
}

export function SpanRow({ row }: { row: TraceRailRow }) {
  const duration = formatDuration(spanDuration(row));
  const style: RailStyle = {
    "--rail-depth": row.depth,
    "--rail-offset": `${row.offsetPercent}%`,
    "--rail-width": `${row.widthPercent}%`,
  };

  return (
    <li className={`span-row signal-${row.signal}`} style={style}>
      <div
        className="span-row-content"
        data-span-id={row.spanId}
      >
        <span className="span-identity">
          <strong>{row.span.name}</strong>
          <code>{row.span.kind.toUpperCase()}</code>
        </span>
        <span className="span-actor">{row.span.agentId}</span>
        <span className="span-duration">{duration}</span>
        <span className="span-rail-visual" aria-hidden="true">
          <i />
        </span>
      </div>
    </li>
  );
}
