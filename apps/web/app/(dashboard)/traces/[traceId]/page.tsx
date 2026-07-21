import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionLedger } from "../../../../components/action-ledger";
import { EvidenceDrawer } from "../../../../components/evidence-drawer";
import { TraceHeader } from "../../../../components/trace-header";
import { TraceRail } from "../../../../components/trace-rail";
import { configuredProjectId } from "../../../../lib/project-context";
import { getTraceDetail } from "../../../../lib/trace-read-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Trace evidence" };

export default async function TraceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ traceId: string }>;
  searchParams: Promise<{ span?: string | string[] }>;
}) {
  const { traceId } = await params;
  const query = await searchParams;
  const trace = await getTraceDetail(configuredProjectId(), traceId);
  if (trace === null) notFound();
  const selectedSpanId = Array.isArray(query.span) ? query.span[0] : query.span;
  const selectedSpan = trace.spans.find(
    (span) => span.spanId === selectedSpanId,
  );

  return (
    <>
      <TraceHeader trace={trace} />
      <TraceRail trace={trace} />
      <ActionLedger traceId={trace.traceId} spans={trace.spans} />
      {selectedSpan === undefined ? null : (
        <EvidenceDrawer traceId={trace.traceId} span={selectedSpan} />
      )}
    </>
  );
}
