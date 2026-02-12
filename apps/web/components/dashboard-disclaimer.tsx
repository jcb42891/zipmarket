import {
  METRIC_TOOLTIP_COPY,
  ROLLING_WINDOW_TOOLTIP_COPY
} from "../lib/dashboard/dashboard-presenter";

const tooltipItems = [
  {
    label: "Sale-to-list ratio",
    copy: METRIC_TOOLTIP_COPY.sale_to_list_ratio
  },
  {
    label: "Sold over list",
    copy: METRIC_TOOLTIP_COPY.sold_over_list_pct
  },
  {
    label: "New listings",
    copy: METRIC_TOOLTIP_COPY.new_listings
  },
  {
    label: "Rolling monthly periods",
    copy: ROLLING_WINDOW_TOOLTIP_COPY
  }
] as const;

interface DashboardDisclaimerProps {
  disclaimer: string;
  source?: string;
  lastUpdated?: string | null;
}

function formatLastUpdated(lastUpdated?: string | null): string {
  if (!lastUpdated) {
    return "Last updated date unavailable";
  }

  const date = new Date(lastUpdated);
  if (Number.isNaN(date.getTime())) {
    return "Last updated date unavailable";
  }

  return `Last updated ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

export function DashboardDisclaimer({
  disclaimer,
  source,
  lastUpdated
}: DashboardDisclaimerProps) {
  return (
    <aside className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-tight">
        Data methodology
      </h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{disclaimer}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tooltipItems.map((item) => (
          <span
            key={item.label}
            title={item.copy}
            className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]"
          >
            {item.label}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--text-subtle)]">
        {source ? `${source}. ` : ""}
        {formatLastUpdated(lastUpdated)}.
      </p>
    </aside>
  );
}
