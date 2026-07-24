import Link from "next/link";

export function RecordedDataAction({
  traceId,
  spanId,
  hasPayload,
  origin,
}: {
  traceId: string;
  spanId: string;
  hasPayload: boolean;
  origin: "steps" | "timeline" | "actions";
}) {
  if (!hasPayload) {
    return <span className="metadata-only">Metadata only</span>;
  }

  return (
    <Link
      className="recorded-data-action"
      href={`/traces/${encodeURIComponent(traceId)}?span=${encodeURIComponent(spanId)}`}
      data-span-id={spanId}
      data-evidence-origin={origin}
    >
      Inspect recorded data
    </Link>
  );
}
