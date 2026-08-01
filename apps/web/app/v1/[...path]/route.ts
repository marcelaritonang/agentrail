import { hostedIngestRequestHandler } from "../../../lib/hosted-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return hostedIngestRequestHandler(request);
}

export async function POST(request: Request): Promise<Response> {
  return hostedIngestRequestHandler(request);
}
