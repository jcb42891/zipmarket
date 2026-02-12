import {
  normalizeDateRangeSelection,
  type DashboardDateBounds,
  type DashboardDateRange
} from "./date-range";

interface ShortcutDefinition {
  key: string;
  label: string;
  expression: string;
}

type RelativeUnit = "d" | "w" | "m" | "y";

export interface DashboardDateQuickOption {
  key: string;
  label: string;
  expression: string;
  range: DashboardDateRange;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXPLICIT_RANGE_PATTERN = /^(\d{4}-\d{2}-\d{2})\s*(?:to|\.\.)\s*(\d{4}-\d{2}-\d{2})$/;
const RELATIVE_PATTERN = /^(?:last\s+)?(\d+)\s*([a-z]+)$/;
const NAMED_EXPRESSIONS = new Map<string, { amount: number; unit: RelativeUnit } | "all">([
  ["all", "all"],
  ["all time", "all"],
  ["last month", { amount: 1, unit: "m" }],
  ["last quarter", { amount: 3, unit: "m" }],
  ["last year", { amount: 1, unit: "y" }]
]);
const UNIT_ALIASES = new Map<string, RelativeUnit>([
  ["d", "d"],
  ["day", "d"],
  ["days", "d"],
  ["w", "w"],
  ["wk", "w"],
  ["wks", "w"],
  ["week", "w"],
  ["weeks", "w"],
  ["m", "m"],
  ["mo", "m"],
  ["mos", "m"],
  ["month", "m"],
  ["months", "m"],
  ["y", "y"],
  ["yr", "y"],
  ["yrs", "y"],
  ["year", "y"],
  ["years", "y"]
]);
const QUICK_OPTION_DEFINITIONS: ShortcutDefinition[] = [
  {
    key: "last_90_days",
    label: "90 days",
    expression: "90d"
  },
  {
    key: "last_6_months",
    label: "6 months",
    expression: "6m"
  },
  {
    key: "last_12_months",
    label: "12 months",
    expression: "12m"
  },
  {
    key: "all_time",
    label: "All time",
    expression: "all"
  }
];

function formatIsoUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoUtcDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return formatIsoUtcDate(parsedDate) === value ? parsedDate : null;
}

function subtractDays(anchorDate: string, days: number): string {
  const parsedAnchorDate = parseIsoUtcDate(anchorDate);
  if (parsedAnchorDate === null) {
    return anchorDate;
  }

  parsedAnchorDate.setUTCDate(parsedAnchorDate.getUTCDate() - days);
  return formatIsoUtcDate(parsedAnchorDate);
}

function subtractMonths(anchorDate: string, months: number): string {
  const parsedAnchorDate = parseIsoUtcDate(anchorDate);
  if (parsedAnchorDate === null) {
    return anchorDate;
  }

  const year = parsedAnchorDate.getUTCFullYear();
  const monthIndex = parsedAnchorDate.getUTCMonth();
  const dayOfMonth = parsedAnchorDate.getUTCDate();
  const shiftedBase = new Date(Date.UTC(year, monthIndex - months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(shiftedBase.getUTCFullYear(), shiftedBase.getUTCMonth() + 1, 0)
  ).getUTCDate();
  shiftedBase.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return formatIsoUtcDate(shiftedBase);
}

function subtractRelative(anchorDate: string, amount: number, unit: RelativeUnit): string {
  if (unit === "d") {
    return subtractDays(anchorDate, amount);
  }

  if (unit === "w") {
    return subtractDays(anchorDate, amount * 7);
  }

  if (unit === "m") {
    return subtractMonths(anchorDate, amount);
  }

  return subtractMonths(anchorDate, amount * 12);
}

export function parseDashboardDateExpression(
  expression: string,
  anchorDate: string,
  bounds: DashboardDateBounds
): DashboardDateRange | null {
  const hasValidAnchorDate = parseIsoUtcDate(anchorDate) !== null;
  const trimmedExpression = expression.trim();
  if (trimmedExpression.length === 0) {
    return null;
  }

  const normalizedExpression = trimmedExpression.toLowerCase();
  if (NAMED_EXPRESSIONS.has(normalizedExpression)) {
    const namedExpression = NAMED_EXPRESSIONS.get(normalizedExpression);
    if (namedExpression === "all") {
      return {
        startDate: bounds.minDate,
        endDate: bounds.maxDate
      };
    }

    if (namedExpression) {
      if (!hasValidAnchorDate) {
        return null;
      }

      return normalizeDateRangeSelection(
        {
          startDate: subtractRelative(anchorDate, namedExpression.amount, namedExpression.unit),
          endDate: anchorDate
        },
        bounds
      );
    }
  }

  if (ISO_DATE_PATTERN.test(trimmedExpression)) {
    if (parseIsoUtcDate(trimmedExpression) === null) {
      return null;
    }

    return normalizeDateRangeSelection(
      {
        startDate: trimmedExpression,
        endDate: trimmedExpression
      },
      bounds
    );
  }

  const explicitRangeMatch = trimmedExpression.match(EXPLICIT_RANGE_PATTERN);
  if (explicitRangeMatch) {
    if (
      parseIsoUtcDate(explicitRangeMatch[1]) === null ||
      parseIsoUtcDate(explicitRangeMatch[2]) === null
    ) {
      return null;
    }

    return normalizeDateRangeSelection(
      {
        startDate: explicitRangeMatch[1],
        endDate: explicitRangeMatch[2]
      },
      bounds
    );
  }

  const relativeMatch = normalizedExpression.match(RELATIVE_PATTERN);
  if (!relativeMatch) {
    return null;
  }

  const amount = Number(relativeMatch[1]);
  if (!Number.isInteger(amount) || amount <= 0) {
    return null;
  }

  const unit = UNIT_ALIASES.get(relativeMatch[2]);
  if (!unit) {
    return null;
  }

  if (unit === "d" && amount === 30) {
    return null;
  }

  if (!hasValidAnchorDate) {
    return null;
  }

  return normalizeDateRangeSelection(
    {
      startDate: subtractRelative(anchorDate, amount, unit),
      endDate: anchorDate
    },
    bounds
  );
}

export function buildDashboardDateQuickOptions(
  anchorDate: string,
  bounds: DashboardDateBounds
): DashboardDateQuickOption[] {
  return QUICK_OPTION_DEFINITIONS.flatMap((definition) => {
    const range = parseDashboardDateExpression(definition.expression, anchorDate, bounds);
    if (range === null) {
      return [];
    }

    return {
      ...definition,
      range
    };
  });
}
