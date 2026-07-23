import { FileX } from "@phosphor-icons/react/ssr";
import Link from "next/link";

export default function TraceNotFound() {
  return (
    <section className="trace-not-found" aria-labelledby="not-found-title">
      <FileX aria-hidden="true" size={24} weight="regular" />
      <span className="empty-code">RECORDER / 404</span>
      <h1 id="not-found-title">Run not found</h1>
      <p>
        The agent run does not exist in this project scope or is no longer
        available.
      </p>
      <Link href="/traces">Back to all agent runs</Link>
    </section>
  );
}
