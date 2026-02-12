import type { DashboardSupportedResponse } from "../api/contracts";

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export interface DashboardDateBounds {
  minDate: string;
  maxDate: string;
}

interface DashboardSeriesPoint {
  periodEnd: string;
  medianSalePrice: number | null;
  medianListPrice: number | null;
  homesSold: number | null;
  newListings: number | null;
  avgSaleToList: number | null;
  soldAboveList: number | null;
}

interface DashboardWindowSummary {
  medianSalePriceAverage: number | null;
  medianListPriceAverage: number | null;
  homesSoldTotal: number | null;
  newListingsTotal: number | null;
  avgSaleToListAverage: number | null;
  soldAboveListAverage: number | null;
}

function toSeriesPoints(payload: DashboardSupportedResponse): DashboardSeriesPoint[] {
  return payload.series.period_end.map((periodEnd, index) => ({
    periodEnd,
    medianSalePrice: payload.series.median_sale_price[index] ?? null,
    medianListPrice: payload.series.median_list_price[index] ?? null,
    homesSold: payload.series.homes_sold[index] ?? null,
    newListings: payload.series.new_listings[index] ?? null,
    avgSaleToList: payload.series.avg_sale_to_list[index] ?? null,
    soldAboveList: payload.series.sold_above_list[index] ?? null
  }));
}

function clampIsoDate(value: string, bounds: DashboardDateBounds): string {
  if (value < bounds.minDate) {
    return bounds.minDate;
  }

  if (value > bounds.maxDate) {
    return bounds.maxDate;
  }

  return value;
}

function toPercent(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return value * 100;
}

function toRateChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return (current - previous) / previous;
}

function averageOrNull(values: Array<number | null>): number | null {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (value === null) {
      continue;
    }

    total += value;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return total / count;
}

function sumOrNull(values: Array<number | null>): number | null {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    if (value === null) {
      continue;
    }

    total += value;
    hasValue = true;
  }

  return hasValue ? total : null;
}

function summarizeWindow(points: DashboardSeriesPoint[]): DashboardWindowSummary {
  return {
    medianSalePriceAverage: averageOrNull(points.map((point) => point.medianSalePrice)),
    medianListPriceAverage: averageOrNull(points.map((point) => point.medianListPrice)),
    homesSoldTotal: sumOrNull(points.map((point) => point.homesSold)),
    newListingsTotal: sumOrNull(points.map((point) => point.newListings)),
    avgSaleToListAverage: averageOrNull(points.map((point) => point.avgSaleToList)),
    soldAboveListAverage: averageOrNull(points.map((point) => point.soldAboveList))
  };
}

function subtractMonths(dateString: string, months: number): string {
  const [yearText, monthText, dayText] = dateString.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const shiftedBase = new Date(Date.UTC(year, monthIndex - months, 1));
  const lastDayOfMonth = new Date(
    Date.UTC(shiftedBase.getUTCFullYear(), shiftedBase.getUTCMonth() + 1, 0)
  ).getUTCDate();
  shiftedBase.setUTCDate(Math.min(day, lastDayOfMonth));
  return shiftedBase.toISOString().slice(0, 10);
}

function competitivenessScore(
  avgSaleToList: number | null,
  soldAboveList: number | null,
  newListingsYoy: number | null,
  homesSoldYoy: number | null
): number | null {
  if (avgSaleToList === null || soldAboveList === null) {
    return null;
  }

  let score = 0;

  if (avgSaleToList >= 1.05) {
    score += 3;
  } else if (avgSaleToList >= 1.02) {
    score += 2;
  } else if (avgSaleToList >= 1.0) {
    score += 1;
  } else if (avgSaleToList >= 0.98) {
    score += 0;
  } else {
    score -= 1;
  }

  if (soldAboveList >= 0.6) {
    score += 3;
  } else if (soldAboveList >= 0.45) {
    score += 2;
  } else if (soldAboveList >= 0.3) {
    score += 1;
  } else if (soldAboveList >= 0.15) {
    score += 0;
  } else {
    score -= 1;
  }

  if (newListingsYoy !== null) {
    if (newListingsYoy <= -0.15) {
      score += 2;
    } else if (newListingsYoy <= -0.05) {
      score += 1;
    } else if (newListingsYoy < 0.05) {
      score += 0;
    } else if (newListingsYoy < 0.15) {
      score -= 1;
    } else {
      score -= 2;
    }
  }

  if (homesSoldYoy !== null) {
    if (homesSoldYoy >= 0.1) {
      score += 1;
    } else if (homesSoldYoy <= -0.1) {
      score -= 1;
    }
  }

  return score;
}

function competitivenessLabel(score: number | null): string | null {
  if (score === null) {
    return null;
  }

  if (score <= 0) {
    return "Buyer-leaning";
  }

  if (score <= 3) {
    return "Balanced";
  }

  if (score <= 6) {
    return "Competitive";
  }

  return "Very competitive";
}

function competitivenessExplanation(
  avgSaleToList: number | null,
  soldAboveList: number | null,
  newListingsYoy: number | null,
  homesSoldYoy: number | null
): string {
  const fragments: string[] = [];

  if (soldAboveList !== null) {
    if (soldAboveList >= 0.6) {
      fragments.push("Most homes are selling over list.");
    } else if (soldAboveList >= 0.3) {
      fragments.push("A meaningful share of homes are selling over list.");
    } else if (soldAboveList < 0.15) {
      fragments.push("Few homes are selling over list.");
    }
  }

  if (avgSaleToList !== null) {
    if (avgSaleToList >= 1) {
      fragments.push("Prices are landing at/above asking.");
    } else if (avgSaleToList < 0.98) {
      fragments.push("Prices are usually landing below asking.");
    }
  }

  if (newListingsYoy !== null) {
    if (newListingsYoy <= -0.05) {
      fragments.push("New listings are down from last year.");
    } else if (newListingsYoy >= 0.05) {
      fragments.push("New listings are up from last year.");
    }
  }

  if (homesSoldYoy !== null) {
    if (homesSoldYoy >= 0.1) {
      fragments.push("Sales activity is rising year over year.");
    } else if (homesSoldYoy <= -0.1) {
      fragments.push("Sales activity is falling year over year.");
    }
  }

  if (fragments.length === 0) {
    return "Recent trends are mixed with no dominant signal.";
  }

  const explanation =
    fragments.length > 1 ? `${fragments[0]} ${fragments[1]}` : fragments[0];
  if (explanation.length > 180) {
    return `${explanation.slice(0, 177)}...`;
  }

  return explanation;
}

function confidenceTier(trailingMonthCount: number, coreMetricsComplete: boolean): string {
  if (trailingMonthCount >= 36 && coreMetricsComplete) {
    return "high";
  }

  if (trailingMonthCount >= 30 && coreMetricsComplete) {
    return "medium";
  }

  if (trailingMonthCount >= 24) {
    return "low";
  }

  return "insufficient";
}

export function resolveDashboardDateBounds(
  payload: DashboardSupportedResponse
): DashboardDateBounds {
  const availableDates = payload.series.period_end;
  if (availableDates.length === 0) {
    return {
      minDate: payload.latest_period_end,
      maxDate: payload.latest_period_end
    };
  }

  return {
    minDate: availableDates[0],
    maxDate: availableDates[availableDates.length - 1]
  };
}

export function createDefaultDashboardDateRange(
  payload: DashboardSupportedResponse
): DashboardDateRange {
  const bounds = resolveDashboardDateBounds(payload);
  return {
    startDate: bounds.minDate,
    endDate: bounds.maxDate
  };
}

export function normalizeDateRangeSelection(
  range: DashboardDateRange,
  bounds: DashboardDateBounds
): DashboardDateRange {
  const clampedStartDate = clampIsoDate(range.startDate, bounds);
  const clampedEndDate = clampIsoDate(range.endDate, bounds);

  if (clampedStartDate > clampedEndDate) {
    return {
      startDate: clampedStartDate,
      endDate: clampedStartDate
    };
  }

  return {
    startDate: clampedStartDate,
    endDate: clampedEndDate
  };
}

export function buildDashboardPayloadForDateRange(
  payload: DashboardSupportedResponse,
  range: DashboardDateRange
): DashboardSupportedResponse {
  const sourcePoints = toSeriesPoints(payload);
  if (sourcePoints.length === 0) {
    return payload;
  }

  const normalizedRange = normalizeDateRangeSelection(
    range,
    resolveDashboardDateBounds(payload)
  );
  const selectedPoints = sourcePoints.filter(
    (point) =>
      point.periodEnd >= normalizedRange.startDate && point.periodEnd <= normalizedRange.endDate
  );

  if (selectedPoints.length === 0) {
    return payload;
  }

  const firstPoint = selectedPoints[0];
  const latestPoint = selectedPoints[selectedPoints.length - 1];
  const selectedWindowSummary = summarizeWindow(selectedPoints);
  const latestPointSourceIndex = sourcePoints.findIndex(
    (point) => point.periodEnd === latestPoint.periodEnd
  );
  const firstPointSourceIndex = sourcePoints.findIndex(
    (point) => point.periodEnd === firstPoint.periodEnd
  );
  const previousPoint =
    latestPointSourceIndex > 0 ? sourcePoints[latestPointSourceIndex - 1] : null;
  const previousWindowStartIndex = Math.max(
    0,
    firstPointSourceIndex - selectedPoints.length
  );
  const previousWindowPoints =
    firstPointSourceIndex > 0
      ? sourcePoints.slice(previousWindowStartIndex, firstPointSourceIndex)
      : [];
  const previousWindowSummary = summarizeWindow(previousWindowPoints);
  const medianListPriceYoy = toRateChange(
    selectedWindowSummary.medianListPriceAverage,
    previousWindowSummary.medianListPriceAverage
  );
  const medianSalePriceYoy = toRateChange(
    selectedWindowSummary.medianSalePriceAverage,
    previousWindowSummary.medianSalePriceAverage
  );
  const saleToListYoy = toRateChange(
    selectedWindowSummary.avgSaleToListAverage,
    previousWindowSummary.avgSaleToListAverage
  );
  const soldOverListYoy = toRateChange(
    selectedWindowSummary.soldAboveListAverage,
    previousWindowSummary.soldAboveListAverage
  );
  const newListingsYoy = toRateChange(
    selectedWindowSummary.newListingsTotal,
    previousWindowSummary.newListingsTotal
  );
  const homesSoldYoy = toRateChange(
    selectedWindowSummary.homesSoldTotal,
    previousWindowSummary.homesSoldTotal
  );
  const medianListPriceMom =
    selectedPoints.length > 1
      ? toRateChange(latestPoint.medianListPrice, firstPoint.medianListPrice)
      : toRateChange(latestPoint.medianListPrice, previousPoint?.medianListPrice ?? null);
  const medianSalePriceMom =
    selectedPoints.length > 1
      ? toRateChange(latestPoint.medianSalePrice, firstPoint.medianSalePrice)
      : toRateChange(latestPoint.medianSalePrice, previousPoint?.medianSalePrice ?? null);
  const trailingWindowStart = subtractMonths(latestPoint.periodEnd, 35);
  const trailingMonthCount = sourcePoints.filter(
    (point) =>
      point.periodEnd >= trailingWindowStart && point.periodEnd <= latestPoint.periodEnd
  ).length;
  const coreMetricsComplete =
    latestPoint.medianSalePrice !== null &&
    latestPoint.homesSold !== null &&
    latestPoint.avgSaleToList !== null &&
    latestPoint.soldAboveList !== null;
  const score = competitivenessScore(
    selectedWindowSummary.avgSaleToListAverage,
    selectedWindowSummary.soldAboveListAverage,
    newListingsYoy,
    homesSoldYoy
  );

  return {
    ...payload,
    latest_period_end: latestPoint.periodEnd,
    kpis: {
      median_list_price: {
        value: selectedWindowSummary.medianListPriceAverage,
        yoy_change: medianListPriceYoy,
        mom_change: medianListPriceMom
      },
      median_sale_price: {
        value: selectedWindowSummary.medianSalePriceAverage,
        yoy_change: medianSalePriceYoy,
        mom_change: medianSalePriceMom
      },
      sale_to_list_ratio: {
        value: selectedWindowSummary.avgSaleToListAverage,
        over_under_pct:
          selectedWindowSummary.avgSaleToListAverage === null
            ? null
            : (selectedWindowSummary.avgSaleToListAverage - 1) * 100,
        yoy_change: saleToListYoy
      },
      sold_over_list_pct: {
        value_pct: toPercent(selectedWindowSummary.soldAboveListAverage),
        yoy_change: toPercent(soldOverListYoy)
      },
      new_listings: {
        value: selectedWindowSummary.newListingsTotal,
        yoy_change: newListingsYoy
      },
      homes_sold: {
        value: selectedWindowSummary.homesSoldTotal,
        yoy_change: homesSoldYoy
      }
    },
    series: {
      period_end: selectedPoints.map((point) => point.periodEnd),
      median_sale_price: selectedPoints.map((point) => point.medianSalePrice),
      median_list_price: selectedPoints.map((point) => point.medianListPrice),
      avg_sale_to_list: selectedPoints.map((point) => point.avgSaleToList),
      sold_above_list: selectedPoints.map((point) => point.soldAboveList),
      new_listings: selectedPoints.map((point) => point.newListings),
      homes_sold: selectedPoints.map((point) => point.homesSold)
    },
    competitiveness: {
      score,
      label: competitivenessLabel(score),
      explanation: competitivenessExplanation(
        selectedWindowSummary.avgSaleToListAverage,
        selectedWindowSummary.soldAboveListAverage,
        newListingsYoy,
        homesSoldYoy
      ),
      confidence_tier: confidenceTier(trailingMonthCount, coreMetricsComplete)
    }
  };
}
