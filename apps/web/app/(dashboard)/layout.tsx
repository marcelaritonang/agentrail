import { GithubLogo, Rows } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { ProductMark } from "../../components/product-mark";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-frame">
      <header className="dashboard-header">
        <Link
          className="dashboard-brand"
          href="/traces"
          aria-label="AgentRail traces"
        >
          <ProductMark />
          <strong>AgentRail</strong>
          <span>M1 recorder</span>
        </Link>

        <nav className="dashboard-nav" aria-label="Dashboard">
          <Link href="/traces" aria-current="page">
            <Rows aria-hidden="true" size={15} weight="regular" />
            Traces
          </Link>
        </nav>

        <div className="dashboard-meta">
          <span className="sample-stamp">SAMPLE DATA</span>
          <a href="https://github.com" aria-label="AgentRail source on GitHub">
            <GithubLogo aria-hidden="true" size={16} weight="regular" />
            Source
          </a>
        </div>
      </header>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
