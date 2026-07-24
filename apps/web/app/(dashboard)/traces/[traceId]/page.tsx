import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionLedger } from "../../../../components/action-ledger";
import { EvidenceDrawer } from "../../../../components/evidence-drawer";
import { ReadOnlyExampleBanner } from "../../../../components/read-only-example";
import { TraceHeader } from "../../../../components/trace-header";
import { TraceRail } from "../../../../components/trace-rail";
import { WhatHappened } from "../../../../components/what-happened";
import {
  DEMO_TRACE_ID,
  demoModeEnabled,
  isReadOnlySampleTrace,
} from "../../../../lib/demo-mode";
import { configuredProjectId } from "../../../../lib/project-context";
import { presentTraceDetail } from "../../../../lib/trace-presentation";
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
  const demoTrace = demoModeEnabled() && trace.traceId === DEMO_TRACE_ID;
  const isReadOnlyExample = demoTrace || isReadOnlySampleTrace(trace);
  const presentation = presentTraceDetail(trace, { isReadOnlyExample });

  return (
    <>
      {isReadOnlyExample ? <ReadOnlyExampleBanner detail /> : null}
      <TraceHeader trace={trace} presentation={presentation} />
      <WhatHappened trace={trace} presentation={presentation} />
      <TraceRail trace={trace} />
      <ActionLedger traceId={trace.traceId} spans={trace.spans} />
      {selectedSpan?.hasPayload === true ? (
        <EvidenceDrawer traceId={trace.traceId} span={selectedSpan} />
      ) : null}
    </>
  );
}
