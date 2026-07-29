import { GithubLogo, Rows } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { ProductMark } from "../../components/product-mark";
import { ReadOnlyExampleIndicator } from "../../components/read-only-example";
import { demoModeEnabled } from "../../lib/demo-mode";
import { configuredSourceUrl } from "../../lib/source-url";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demoMode = demoModeEnabled();
  const sourceUrl = configuredSourceUrl();

  return (
    <div className="dashboard-frame">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="AgentRail home">
          <ProductMark />
          <strong>AgentRail</strong>
        </Link>

        <nav className="dashboard-nav" aria-label="Dashboard">
          <Link href="/traces" aria-current="page">
            <Rows aria-hidden="true" size={15} weight="regular" />
            Agent runs
          </Link>
        </nav>

        <div className="dashboard-meta">
          {demoMode ? <ReadOnlyExampleIndicator /> : null}
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              <GithubLogo aria-hidden="true" size={16} weight="regular" />
              Source
            </a>
          ) : null}
        </div>
      </header>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
