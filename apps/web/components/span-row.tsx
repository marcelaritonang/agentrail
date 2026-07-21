import Link from "next/link";
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
  const href = `/traces/${encodeURIComponent(row.span.traceId)}?span=${encodeURIComponent(
    row.spanId,
  )}`;

  return (
    <li className={`span-row signal-${row.signal}`} style={style}>
      <Link
        className="span-row-link"
        href={href}
        data-span-id={row.spanId}
        aria-label={`${row.span.name}, ${row.span.kind}, ${duration}, actor ${row.span.agentId}`}
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
      </Link>
    </li>
  );
}
