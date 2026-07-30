import {
  ChartLineUp,
  GitBranch,
  Rows,
  TerminalWindow,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { ProductMark } from "../../components/product-mark";

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-frame product-frame">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="AgentRail home">
          <ProductMark />
          <strong>AgentRail</strong>
        </Link>

        <nav className="dashboard-nav" aria-label="Product dashboard">
          <Link href="/dashboard">
            <ChartLineUp aria-hidden="true" size={15} weight="regular" />
            Overview
          </Link>
          <Link href="/dashboard/integrations">
            <GitBranch aria-hidden="true" size={15} weight="regular" />
            Integrations
          </Link>
          <Link href="/traces">
            <Rows aria-hidden="true" size={15} weight="regular" />
            Agent runs
          </Link>
        </nav>

        <div className="dashboard-meta">
          <span className="sample-stamp">Private beta</span>
          <a
            href="https://www.npmjs.com/org/agentrail-sdk"
            target="_blank"
            rel="noreferrer"
          >
            <TerminalWindow aria-hidden="true" size={16} weight="regular" />
            npm
          </a>
        </div>
      </header>
      <main className="dashboard-main product-main">{children}</main>
    </div>
  );
}
