import Link from "next/link";

import { readPublicAgentRailConfig } from "../lib/public-config";
import { ProductMark } from "./product-mark";

export function PublicSiteShell({ children }: { children: React.ReactNode }) {
  const config = readPublicAgentRailConfig();

  return (
    <main className="public-site">
      <nav className="landing-nav" aria-label="Public navigation">
        <Link href="/" className="landing-brand" aria-label="AgentRail home">
          <ProductMark />
          <span>AgentRail</span>
        </Link>
        <div className="landing-nav-links">
          <Link href="/about">About</Link>
          <Link href="/architecture">Architecture</Link>
          <Link href="/founding-testers">Founding testers</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/security">Security</Link>
          {config.contactUrl === null ? null : (
            <a href={config.contactUrl.href} target="_blank" rel="noreferrer">
              Contact
            </a>
          )}
        </div>
      </nav>
      <div className="public-site-main">{children}</div>
    </main>
  );
}
