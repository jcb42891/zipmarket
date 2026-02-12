import type { DashboardSegment } from "@zipmarket/shared";

import type { DashboardSupportedResponse } from "../api/contracts";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const compactIntegerFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1
});

export const SEGMENT_OPTIONS: ReadonlyArray<{
  key: DashboardSegment;
  label: string;
}> = [
  { key: "all", label: "All homes" },
  { key: "single_family", label: "Single-family" },
  { key: "condo_coop", label: "Condo/co-op" },
  { key: "townhouse", label: "Townhouse" }
];

export const METRIC_TOOLTIP_COPY = {
  median_list_price:
    "Historical median asking price from rolling monthly Redfin aggregates. Not a live listing feed.",
  median_sale_price:
    "Historical median closed sale price by period. This is based on recorded closings, not active inventory.",
  sale_to_list_ratio:
    "Median sale-to-list ratio (median sale price divided by median list price) for each period.",
  sold_over_list_pct:
    "Share of closed sales above list price during each rolling monthly period.",
  new_listings:
    "Historical new-listing activity in each rolling monthly period. This is not a live inventory count.",
  homes_sold: "Historical count of closed home sales in each rolling monthly period."
} as const;

export const ROLLING_WINDOW_TOOLTIP_COPY =
  "Redfin monthly periods are rolling aggregates, not strict calendar-month closes.";

function signPrefix(value: number): string {
  return value > 0 ? "+" : "";
}

export function toSegmentLabel(segment: DashboardSegment): string {
  const segmentOption = SEGMENT_OPTIONS.find((option) => option.key === segment);
  return segmentOption?.label ?? "All homes";
}

export function formatLocationHeading(zip: string, city?: string | null): string {
  const normalizedCity = city?.trim() ?? "";
  if (!normalizedCity) {
    return `ZIP ${zip}`;
  }

  return `${normalizedCity} (ZIP ${zip})`;
}

export function formatCurrency(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return currencyFormatter.format(value);
}

export function formatCurrencyCompact(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return compactCurrencyFormatter.format(value);
}

export function formatRatio(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return value.toFixed(3);
}

export function formatPercent(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(1)}%`;
}

export function formatSignedPercent(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return `${signPrefix(value)}${value.toFixed(1)}%`;
}

export function formatSignedPercentChange(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  const percentValue = value * 100;
  return `${signPrefix(percentValue)}${percentValue.toFixed(1)}%`;
}

export function formatCount(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return integerFormatter.format(value);
}

export function formatCountCompact(value: number | null): string {
  if (value === null) {
    return "No data";
  }

  return compactIntegerFormatter.format(value);
}

export function formatPeriodLabel(periodEnd: string): string {
  const matches = /^(\d{4})-(\d{2})-\d{2}$/.exec(periodEnd);
  if (!matches) {
    return periodEnd;
  }

  const monthIndex = Number(matches[2]) - 1;
  if (monthIndex < 0 || monthIndex >= MONTH_LABELS.length) {
    return periodEnd;
  }

  return `${MONTH_LABELS[monthIndex]} ${matches[1]}`;
}

function toRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

export interface DashboardKpiCard {
  key: keyof DashboardSupportedResponse["kpis"];
  label: string;
  tooltip: string;
  value: string;
  primaryDelta: string;
  secondaryDelta: string | null;
}

export function buildKpiCards(payload: DashboardSupportedResponse): DashboardKpiCard[] {
  return [
    {
      key: "median_list_price",
      label: "Median List Price",
      tooltip: METRIC_TOOLTIP_COPY.median_list_price,
      value: formatCurrency(payload.kpis.median_list_price.value),
      primaryDelta: `MoM ${formatSignedPercentChange(payload.kpis.median_list_price.mom_change)}`,
      secondaryDelta: `YoY ${formatSignedPercentChange(payload.kpis.median_list_price.yoy_change)}`
    },
    {
      key: "median_sale_price",
      label: "Median Sale Price",
      tooltip: METRIC_TOOLTIP_COPY.median_sale_price,
      value: formatCurrency(payload.kpis.median_sale_price.value),
      primaryDelta: `MoM ${formatSignedPercentChange(payload.kpis.median_sale_price.mom_change)}`,
      secondaryDelta: `YoY ${formatSignedPercentChange(payload.kpis.median_sale_price.yoy_change)}`
    },
    {
      key: "sale_to_list_ratio",
      label: "Sale-to-List Ratio",
      tooltip: METRIC_TOOLTIP_COPY.sale_to_list_ratio,
      value: formatRatio(payload.kpis.sale_to_list_ratio.value),
      primaryDelta: `Over/under ${formatSignedPercent(payload.kpis.sale_to_list_ratio.over_under_pct)}`,
      secondaryDelta: `YoY ${formatSignedPercentChange(payload.kpis.sale_to_list_ratio.yoy_change)}`
    },
    {
      key: "sold_over_list_pct",
      label: "Sold Over List",
      tooltip: METRIC_TOOLTIP_COPY.sold_over_list_pct,
      value: formatPercent(payload.kpis.sold_over_list_pct.value_pct),
      primaryDelta: `YoY ${formatSignedPercent(payload.kpis.sold_over_list_pct.yoy_change)}`,
      secondaryDelta: null
    },
    {
      key: "new_listings",
      label: "New Listings",
      tooltip: METRIC_TOOLTIP_COPY.new_listings,
      value: formatCount(payload.kpis.new_listings.value),
      primaryDelta: `YoY ${formatSignedPercentChange(payload.kpis.new_listings.yoy_change)}`,
      secondaryDelta: null
    },
    {
      key: "homes_sold",
      label: "Homes Sold",
      tooltip: METRIC_TOOLTIP_COPY.homes_sold,
      value: formatCount(payload.kpis.homes_sold.value),
      primaryDelta: `YoY ${formatSignedPercentChange(payload.kpis.homes_sold.yoy_change)}`,
      secondaryDelta: null
    }
  ];
}

export interface DashboardChartRow {
  periodEnd: string;
  periodLabel: string;
  medianSalePrice: number | null;
  medianListPrice: number | null;
  saleToListRatio: number | null;
  soldOverListPct: number | null;
  newListings: number | null;
  homesSold: number | null;
}

export function buildChartRows(payload: DashboardSupportedResponse): DashboardChartRow[] {
  return payload.series.period_end.map((periodEnd, index) => {
    const medianSalePrice = payload.series.median_sale_price[index] ?? null;
    const medianListPrice = payload.series.median_list_price[index] ?? null;

    return {
      periodEnd,
      periodLabel: formatPeriodLabel(periodEnd),
      medianSalePrice,
      medianListPrice,
      saleToListRatio: toRatio(medianSalePrice, medianListPrice),
      soldOverListPct:
        payload.series.sold_above_list[index] === null ||
        payload.series.sold_above_list[index] === undefined
          ? null
          : payload.series.sold_above_list[index] * 100,
      newListings: payload.series.new_listings[index] ?? null,
      homesSold: payload.series.homes_sold[index] ?? null
    };
  });
}
