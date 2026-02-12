"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  DASHBOARD_DISCLAIMER,
  DASHBOARD_SOURCE
} from "../lib/api/contracts";
import {
  fetchDashboardState,
  resolveInitialDashboardState,
  type DashboardPageState
} from "../lib/dashboard/dashboard-client";
import { DashboardDisclaimer } from "./dashboard-disclaimer";
import { ZipSearchForm } from "./zip-search-form";

interface ZipDashboardShellProps {
  zipParam: string;
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatRatio(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return value.toFixed(3);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(1)}%`;
}

function formatDelta(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function DashboardLoadingSkeleton() {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
      <div className="h-7 w-56 animate-pulse rounded bg-[var(--surface-raised)]" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)]"
          />
        ))}
      </div>
      <div className="mt-6 h-52 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)]" />
    </section>
  );
}

function renderStateCard(state: DashboardPageState) {
  if (state.kind === "loading") {
    return <DashboardLoadingSkeleton />;
  }

  if (state.kind === "supported") {
    const { payload } = state;

    const kpiCards = [
      {
        label: "Median List Price",
        value: formatCurrency(payload.kpis.median_list_price.value),
        meta: `YoY ${formatDelta(payload.kpis.median_list_price.yoy_change)}`
      },
      {
        label: "Median Sale Price",
        value: formatCurrency(payload.kpis.median_sale_price.value),
        meta: `YoY ${formatDelta(payload.kpis.median_sale_price.yoy_change)}`
      },
      {
        label: "Sale-to-List Ratio",
        value: formatRatio(payload.kpis.sale_to_list_ratio.value),
        meta: `YoY ${formatDelta(payload.kpis.sale_to_list_ratio.yoy_change)}`
      },
      {
        label: "Sold Over List",
        value: formatPercent(payload.kpis.sold_over_list_pct.value_pct),
        meta: `YoY ${formatPercent(payload.kpis.sold_over_list_pct.yoy_change)}`
      },
      {
        label: "New Listings",
        value:
          payload.kpis.new_listings.value === null
            ? "No data"
            : payload.kpis.new_listings.value.toLocaleString("en-US"),
        meta: `YoY ${formatDelta(payload.kpis.new_listings.yoy_change)}`
      },
      {
        label: "Homes Sold",
        value:
          payload.kpis.homes_sold.value === null
            ? "No data"
            : payload.kpis.homes_sold.value.toLocaleString("en-US"),
        meta: `YoY ${formatDelta(payload.kpis.homes_sold.yoy_change)}`
      }
    ];

    return (
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">
              ZIP {payload.zip}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Latest period ending {payload.latest_period_end}. Segment:{" "}
              {payload.segment.replace("_", " ")}.
            </p>
          </div>
          <p className="rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
            Dashboard shell active
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {kpiCards.map((card) => (
            <article
              key={card.label}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                {card.label}
              </p>
              <p className="mt-2 font-[var(--font-display)] text-2xl font-semibold tracking-tight">
                {card.value}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{card.meta}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-[var(--font-display)] text-xl font-semibold tracking-tight">
            Chart and segmentation surface (M6)
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            This shell reserves space for trend charts, segmentation controls,
            and competitiveness details in the next milestone.
          </p>
        </div>
      </section>
    );
  }

  if (state.kind === "unsupported") {
    return (
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
        <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">
          ZIP {state.payload.zip}
        </h1>
        <p className="mt-2 text-base text-[var(--text-muted)]">
          {state.payload.message}. Try one of these nearby supported ZIP codes:
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {state.payload.nearby_supported_zips.map((suggestion) => (
            <Link
              key={suggestion.zip}
              href={`/zip/${suggestion.zip}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-sm font-semibold transition hover:border-[var(--accent)]"
            >
              <span>{suggestion.zip}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {suggestion.distance_miles.toFixed(1)} mi
              </span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (state.kind === "non_nj") {
    return (
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
        <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">
          ZIP {state.zip}
        </h1>
        <p className="mt-2 text-base text-[var(--text-muted)]">{state.message}</p>
        <p className="mt-2 text-sm text-[var(--text-subtle)]">
          ZipMarket currently supports New Jersey ZIP codes only.
        </p>
      </section>
    );
  }

  if (state.kind === "zip_not_found") {
    return (
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
        <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">
          ZIP {state.zip}
        </h1>
        <p className="mt-2 text-base text-[var(--text-muted)]">{state.message}</p>
        <p className="mt-2 text-sm text-[var(--text-subtle)]">
          Check the ZIP and try again.
        </p>
      </section>
    );
  }

  if (state.kind === "invalid_zip") {
    return (
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
        <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">
          Invalid ZIP
        </h1>
        <p className="mt-2 text-base text-[var(--danger)]">{state.message}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
      <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-base text-[var(--text-muted)]">{state.message}</p>
    </section>
  );
}

export function ZipDashboardShell({ zipParam }: ZipDashboardShellProps) {
  const [state, setState] = useState<DashboardPageState>(() =>
    resolveInitialDashboardState(zipParam)
  );

  useEffect(() => {
    const initialState = resolveInitialDashboardState(zipParam);
    setState(initialState);

    if (initialState.kind !== "loading") {
      return;
    }

    let active = true;
    void fetchDashboardState(initialState.zip).then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, [zipParam]);

  const supportedPayload = state.kind === "supported" ? state.payload : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <ZipSearchForm
          initialZip={state.zip}
          size="compact"
          submitLabel="Search ZIP"
          helperText="Dashboard supports NJ ZIP codes only."
        />
      </section>
      {renderStateCard(state)}
      <DashboardDisclaimer
        disclaimer={supportedPayload?.disclaimer ?? DASHBOARD_DISCLAIMER}
        source={supportedPayload?.methodology.source ?? DASHBOARD_SOURCE}
        lastUpdated={supportedPayload?.methodology.last_updated}
      />
    </div>
  );
}
