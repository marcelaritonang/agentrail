import {
  ChartLineUp,
  ClockCounterClockwise,
  Gauge,
  PlugsConnected,
} from "@phosphor-icons/react/ssr";

import type { UserOverview } from "../../lib/product-read-model";

export function MetricStrip({ overview }: { overview: UserOverview }) {
  const metrics = [
    {
      label: "Packs 7d",
      value: overview.packs7d.toLocaleString("en-US"),
      note: "accepted usage events",
      icon: ChartLineUp,
    },
    {
      label: "Packs 30d",
      value: overview.packs30d.toLocaleString("en-US"),
      note: "project scoped",
      icon: ClockCounterClockwise,
    },
    {
      label: "Estimated context reduction",
      value: `${overview.contextReductionEstimate30d}%`,
      note: "Based on local heuristic token estimates from accepted Context Pack events.",
      icon: Gauge,
    },
    {
      label: "Connected clients",
      value: overview.connectedClients.toLocaleString("en-US"),
      note: `${overview.staleDecisions} stale`,
      icon: PlugsConnected,
    },
  ];

  return (
    <section className="product-metric-strip" aria-label="Usage metrics">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article className="product-metric" key={metric.label}>
            <div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </div>
            <Icon aria-hidden="true" size={18} weight="regular" />
          </article>
        );
      })}
    </section>
  );
}
