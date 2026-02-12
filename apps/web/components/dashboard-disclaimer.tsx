const tooltipPlaceholders = [
  "Sale-to-list ratio",
  "Sold over list",
  "New listings",
  "Rolling monthly windows"
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
        {tooltipPlaceholders.map((item) => (
          <span
            key={item}
            title={`Tooltip copy for ${item} will be finalized in M6.`}
            className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]"
          >
            {item}
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
