"use client";

import type { DashboardSegment } from "@zipmarket/shared";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  DASHBOARD_DISCLAIMER,
  DASHBOARD_SOURCE,
  type DashboardSupportedResponse
} from "../lib/api/contracts";
import {
  fetchDashboardState,
  resolveInitialDashboardState,
  type DashboardPageState
} from "../lib/dashboard/dashboard-client";
import {
  METRIC_TOOLTIP_COPY,
  ROLLING_WINDOW_TOOLTIP_COPY,
  SEGMENT_OPTIONS,
  buildChartRows,
  buildKpiCards,
  formatCountCompact,
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatRatio,
  toSegmentLabel
} from "../lib/dashboard/dashboard-presenter";
import { reduceInfoChipOpenState } from "../lib/dashboard/info-chip";
import { DashboardDisclaimer } from "./dashboard-disclaimer";
import { ZipSearchForm } from "./zip-search-form";

interface ZipDashboardShellProps {
  zipParam: string;
}

interface SegmentControlProps {
  selectedSegment: DashboardSegment;
  isLoading: boolean;
  onChange: (segment: DashboardSegment) => void;
}

function asNumber(value: unknown): number | null {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function InfoChip({ copy }: { copy: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const isTargetInside = containerRef.current?.contains(event.target as Node) ?? false;
      setIsOpen((current) =>
        reduceInfoChipOpenState(current, {
          type: "outside_pointer_down",
          isTargetInside
        })
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      setIsOpen((current) =>
        reduceInfoChipOpenState(current, {
          type: "keydown",
          key: event.key
        })
      );
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() =>
          setIsOpen((current) => reduceInfoChipOpenState(current, { type: "toggle" }))
        }
        aria-label={copy}
        aria-expanded={isOpen}
        aria-controls={tooltipId}
        aria-describedby={isOpen ? tooltipId : undefined}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-muted)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        i
      </button>
      {isOpen ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-[calc(100%+0.45rem)] z-20 w-64 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs font-medium leading-relaxed text-[var(--text-primary)] shadow-[var(--shadow-soft)]"
        >
          {copy}
        </span>
      ) : null}
    </span>
  );
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

function SegmentControl({ selectedSegment, isLoading, onChange }: SegmentControlProps) {
  return (
    <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
        Segment
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SEGMENT_OPTIONS.map((segmentOption) => {
          const isActive = selectedSegment === segmentOption.key;
          return (
            <button
              key={segmentOption.key}
              type="button"
              onClick={() => onChange(segmentOption.key)}
              disabled={isLoading}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {segmentOption.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center text-sm text-[var(--text-muted)]">
      {message}
    </div>
  );
}

function chartTooltipStyle() {
  return {
    backgroundColor: "var(--surface)",
    borderColor: "var(--border)",
    borderRadius: "12px",
    color: "var(--text-primary)",
    boxShadow: "var(--shadow-soft)"
  };
}

function ChartPanel({
  title,
  tooltipCopy,
  children
}: {
  title: string;
  tooltipCopy: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        <InfoChip copy={tooltipCopy} />
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function competitivenessTone(label: string | null): {
  badgeClass: string;
  meterClass: string;
} {
  if (label === "Buyer-leaning") {
    return {
      badgeClass: "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]",
      meterClass: "bg-[var(--success)]"
    };
  }

  if (label === "Very competitive") {
    return {
      badgeClass: "bg-[color-mix(in_oklab,var(--danger)_20%,transparent)] text-[var(--danger)]",
      meterClass: "bg-[var(--danger)]"
    };
  }

  if (label === "Competitive") {
    return {
      badgeClass: "bg-[color-mix(in_oklab,var(--warning)_20%,transparent)] text-[var(--warning)]",
      meterClass: "bg-[var(--warning)]"
    };
  }

  return {
    badgeClass: "bg-[var(--surface)] text-[var(--text-muted)]",
    meterClass: "bg-[var(--accent)]"
  };
}

function toCompetitivenessMeterPercent(score: number | null): number {
  if (score === null) {
    return 0;
  }

  const normalized = ((score + 2) / 10) * 100;
  return Math.max(0, Math.min(100, normalized));
}

function SupportedDashboard({
  payload,
  selectedSegment,
  isLoading,
  onSegmentChange
}: {
  payload: DashboardSupportedResponse;
  selectedSegment: DashboardSegment;
  isLoading: boolean;
  onSegmentChange: (segment: DashboardSegment) => void;
}) {
  const kpiCards = useMemo(() => buildKpiCards(payload), [payload]);
  const chartRows = useMemo(() => buildChartRows(payload), [payload]);

  const hasPriceSeries = chartRows.some(
    (row) => row.medianListPrice !== null || row.medianSalePrice !== null
  );
  const hasSaleToListSeries = chartRows.some((row) => row.saleToListRatio !== null);
  const hasSoldOverListSeries = chartRows.some((row) => row.soldOverListPct !== null);
  const hasNewListingsSeries = chartRows.some((row) => row.newListings !== null);
  const hasHomesSoldSeries = chartRows.some((row) => row.homesSold !== null);

  const tone = competitivenessTone(payload.competitiveness.label);
  const meterPercent = toCompetitivenessMeterPercent(payload.competitiveness.score);
  const competitivenessExplanation =
    payload.competitiveness.explanation ??
    "Competitiveness explanation is unavailable for this ZIP and segment.";
  const confidenceTier =
    payload.competitiveness.confidence_tier?.replace("_", " ") ?? "not available";

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">
            ZIP {payload.zip}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Latest period ending {payload.latest_period_end}. Segment:{" "}
            {toSegmentLabel(payload.segment)}.
          </p>
        </div>
        <p className="rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
          {isLoading ? "Updating segment..." : "Live dashboard"}
        </p>
      </div>

      <SegmentControl
        selectedSegment={selectedSegment}
        isLoading={isLoading}
        onChange={onSegmentChange}
      />

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {kpiCards.map((card) => (
          <article
            key={card.key}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                {card.label}
              </p>
              <InfoChip copy={card.tooltip} />
            </div>
            <p className="mt-2 font-[var(--font-display)] text-2xl font-semibold tracking-tight">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{card.primaryDelta}</p>
            {card.secondaryDelta ? (
              <p className="text-xs text-[var(--text-subtle)]">{card.secondaryDelta}</p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ChartPanel
          title="List vs Sale Price"
          tooltipCopy={`${METRIC_TOOLTIP_COPY.median_list_price} ${ROLLING_WINDOW_TOOLTIP_COPY}`}
        >
          {hasPriceSeries ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    tickFormatter={(value) => formatCurrencyCompact(asNumber(value))}
                    width={66}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    labelStyle={{ color: "var(--text-muted)" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    formatter={(value) => formatCurrency(asNumber(value))}
                  />
                  <Legend wrapperStyle={{ color: "var(--text-muted)", fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="medianListPrice"
                    name="Median list price"
                    stroke="var(--chart-list-line)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="medianSalePrice"
                    name="Median sale price"
                    stroke="var(--chart-sale-line)"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="No list or sale price trend is available for this segment." />
          )}
        </ChartPanel>

        <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Competitiveness
            </h2>
            <InfoChip copy="Heuristic indicator based on sale-to-list ratio, sold-over-list share, and YoY shifts in listings and sales volume." />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className={`rounded-full px-3 py-1 text-sm font-semibold ${tone.badgeClass}`}>
              {payload.competitiveness.label ?? "No label"}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Score:{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {payload.competitiveness.score ?? "N/A"}
              </span>
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${tone.meterClass}`}
              style={{ width: `${meterPercent}%` }}
            />
          </div>
          <p className="mt-4 text-sm text-[var(--text-muted)]">{competitivenessExplanation}</p>
          <p className="mt-3 text-xs text-[var(--text-subtle)]">
            Confidence tier: <span className="font-semibold">{confidenceTier}</span>
          </p>
          <p className="mt-3 text-xs text-[var(--text-subtle)]">
            {ROLLING_WINDOW_TOOLTIP_COPY}
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Sale-to-List Ratio Trend"
          tooltipCopy={`${METRIC_TOOLTIP_COPY.sale_to_list_ratio} ${ROLLING_WINDOW_TOOLTIP_COPY}`}
        >
          {hasSaleToListSeries ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    tickFormatter={(value) => formatRatio(asNumber(value))}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    labelStyle={{ color: "var(--text-muted)" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    formatter={(value) => formatRatio(asNumber(value))}
                  />
                  <Line
                    type="monotone"
                    dataKey="saleToListRatio"
                    name="Ratio"
                    stroke="var(--chart-ratio-line)"
                    strokeWidth={2.4}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="No sale-to-list history is available for this segment." />
          )}
        </ChartPanel>

        <ChartPanel
          title="Sold Over List Trend"
          tooltipCopy={`${METRIC_TOOLTIP_COPY.sold_over_list_pct} ${ROLLING_WINDOW_TOOLTIP_COPY}`}
        >
          {hasSoldOverListSeries ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    tickFormatter={(value) => formatPercent(asNumber(value))}
                    width={58}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    labelStyle={{ color: "var(--text-muted)" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    formatter={(value) => formatPercent(asNumber(value))}
                  />
                  <Line
                    type="monotone"
                    dataKey="soldOverListPct"
                    name="Sold over list"
                    stroke="var(--chart-over-list-line)"
                    strokeWidth={2.4}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="No sold-over-list trend is available for this segment." />
          )}
        </ChartPanel>

        <ChartPanel
          title="New Listings Trend"
          tooltipCopy={`${METRIC_TOOLTIP_COPY.new_listings} ${ROLLING_WINDOW_TOOLTIP_COPY}`}
        >
          {hasNewListingsSeries ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer>
                <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    tickFormatter={(value) => formatCountCompact(asNumber(value))}
                    width={58}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    labelStyle={{ color: "var(--text-muted)" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    formatter={(value) => formatCountCompact(asNumber(value))}
                  />
                  <Bar
                    dataKey="newListings"
                    name="New listings"
                    fill="var(--chart-new-listings-bar)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="No new-listings trend is available for this segment." />
          )}
        </ChartPanel>

        <ChartPanel
          title="Sales Volume Trend"
          tooltipCopy={`${METRIC_TOOLTIP_COPY.homes_sold} ${ROLLING_WINDOW_TOOLTIP_COPY}`}
        >
          {hasHomesSoldSeries ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer>
                <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                    tickFormatter={(value) => formatCountCompact(asNumber(value))}
                    width={58}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    labelStyle={{ color: "var(--text-muted)" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    formatter={(value) => formatCountCompact(asNumber(value))}
                  />
                  <Bar
                    dataKey="homesSold"
                    name="Homes sold"
                    fill="var(--chart-homes-sold-bar)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="No sales-volume trend is available for this segment." />
          )}
        </ChartPanel>
      </div>
    </section>
  );
}

function renderStateCard(
  state: DashboardPageState,
  selectedSegment: DashboardSegment,
  isLoading: boolean,
  onSegmentChange: (segment: DashboardSegment) => void
) {
  if (state.kind === "loading") {
    return <DashboardLoadingSkeleton />;
  }

  if (state.kind === "supported") {
    return (
      <SupportedDashboard
        payload={state.payload}
        selectedSegment={selectedSegment}
        isLoading={isLoading}
        onSegmentChange={onSegmentChange}
      />
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
  const [selectedSegment, setSelectedSegment] = useState<DashboardSegment>("all");
  const [state, setState] = useState<DashboardPageState>(() =>
    resolveInitialDashboardState(zipParam)
  );
  const [isSegmentLoading, setIsSegmentLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const initialState = resolveInitialDashboardState(zipParam);
    if (initialState.kind !== "loading") {
      requestRef.current += 1;
      setState(initialState);
      setIsSegmentLoading(false);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsSegmentLoading(true);
    setState((previousState) =>
      previousState.kind === "supported" && previousState.zip === initialState.zip
        ? previousState
        : initialState
    );

    void fetchDashboardState(initialState.zip, {
      segment: selectedSegment
    }).then((nextState) => {
      if (requestRef.current !== requestId) {
        return;
      }

      setState(nextState);
      setIsSegmentLoading(false);
    });
  }, [zipParam, selectedSegment]);

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
      {renderStateCard(
        state,
        selectedSegment,
        isSegmentLoading,
        (segment) => setSelectedSegment(segment)
      )}
      <DashboardDisclaimer
        disclaimer={supportedPayload?.disclaimer ?? DASHBOARD_DISCLAIMER}
        source={supportedPayload?.methodology.source ?? DASHBOARD_SOURCE}
        lastUpdated={supportedPayload?.methodology.last_updated}
      />
    </div>
  );
}
