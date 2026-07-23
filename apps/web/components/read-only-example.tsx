import Link from "next/link";

import { DEMO_TRACE_ID } from "../lib/demo-mode";

export function ReadOnlyExampleIndicator(): React.ReactNode {
  return <span className="sample-stamp">Read-only example</span>;
}

export function ReadOnlyExampleBanner({
  detail = false,
}: {
  detail?: boolean;
}): React.ReactNode {
  const href = `/traces/${DEMO_TRACE_ID}`;
  return (
    <aside className="read-only-example" aria-label="Read-only example">
      <div>
        <strong>Read-only example</strong>
        <p>
          {detail
            ? "This run uses synthetic data and cannot be changed."
            : "This synthetic example shows how a research agent handled one task."}
        </p>
      </div>
      {detail ? null : <Link href={href}>Explore the sample run</Link>}
    </aside>
  );
}
