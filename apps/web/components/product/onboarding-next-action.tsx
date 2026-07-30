import { ArrowRight, TerminalWindow } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import type { UserOverview } from "../../lib/product-read-model";

const copy = {
  install: {
    title: "Install AgentRail in your local AI agent.",
    body: "Start with the npm package, then activate hosted metrics only when you want private usage analytics.",
    action: "Copy install command from integrations",
    href: "/dashboard/integrations",
  },
  activate: {
    title: "Activate a connected client.",
    body: "Run the CLI login flow and approve the device code from the browser.",
    action: "Open integrations",
    href: "/dashboard/integrations",
  },
  create_first_pack: {
    title: "Create the first context pack.",
    body: "Run AgentRail from Codex or Claude. Local context still returns even when the cloud endpoint is unavailable.",
    action: "View setup",
    href: "/dashboard/integrations",
  },
  report_outcome: {
    title: "Report whether the context helped.",
    body: "Outcome labels make the dashboard useful: helpful, partial, missed, or failed.",
    action: "Open integrations",
    href: "/dashboard/integrations",
  },
} satisfies Record<
  NonNullable<UserOverview["nextAction"]>,
  {
    title: string;
    body: string;
    action: string;
    href: string;
  }
>;

export function OnboardingNextAction({
  nextAction,
}: {
  nextAction: UserOverview["nextAction"];
}) {
  if (nextAction === null) {
    return (
      <section className="product-next-action product-next-action-ok">
        <TerminalWindow aria-hidden="true" size={19} weight="regular" />
        <div>
          <p className="page-eyebrow">Next action</p>
          <h2>Pipeline is receiving usage metadata.</h2>
          <p>Keep watching stale clients and failed outcome labels.</p>
        </div>
      </section>
    );
  }

  const item = copy[nextAction];

  return (
    <section className="product-next-action">
      <TerminalWindow aria-hidden="true" size={19} weight="regular" />
      <div>
        <p className="page-eyebrow">Next action</p>
        <h2>{item.title}</h2>
        <p>{item.body}</p>
        <Link href={item.href}>
          {item.action}
          <ArrowRight aria-hidden="true" size={15} weight="regular" />
        </Link>
      </div>
    </section>
  );
}
