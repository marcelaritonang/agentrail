import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TraceHeader } from "../../../../components/trace-header";
import { TraceRail } from "../../../../components/trace-rail";
import { configuredProjectId } from "../../../../lib/project-context";
import { getTraceDetail } from "../../../../lib/trace-read-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Trace evidence" };

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = await params;
  const trace = await getTraceDetail(configuredProjectId(), traceId);
  if (trace === null) notFound();

  return (
    <>
      <TraceHeader trace={trace} />
      <TraceRail trace={trace} />
    </>
  );
}
