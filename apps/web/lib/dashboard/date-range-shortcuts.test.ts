import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardDateQuickOptions,
  parseDashboardDateExpression
} from "./date-range-shortcuts";

const WIDE_BOUNDS = {
  minDate: "2024-01-01",
  maxDate: "2025-12-31"
};
const NARROW_BOUNDS = {
  minDate: "2025-12-01",
  maxDate: "2025-12-31"
};

test("parseDashboardDateExpression supports relative shorthand like 1d, 2w, 3m", () => {
  assert.deepEqual(parseDashboardDateExpression("1d", "2025-12-31", WIDE_BOUNDS), {
    startDate: "2025-12-30",
    endDate: "2025-12-31"
  });
  assert.deepEqual(parseDashboardDateExpression("2w", "2025-12-31", WIDE_BOUNDS), {
    startDate: "2025-12-17",
    endDate: "2025-12-31"
  });
  assert.deepEqual(parseDashboardDateExpression("3m", "2025-12-31", WIDE_BOUNDS), {
    startDate: "2025-09-30",
    endDate: "2025-12-31"
  });
});

test("parseDashboardDateExpression supports named expressions and long units", () => {
  assert.deepEqual(parseDashboardDateExpression("last month", "2025-12-31", WIDE_BOUNDS), {
    startDate: "2025-11-30",
    endDate: "2025-12-31"
  });
  assert.deepEqual(parseDashboardDateExpression("last quarter", "2025-12-31", WIDE_BOUNDS), {
    startDate: "2025-09-30",
    endDate: "2025-12-31"
  });
  assert.deepEqual(parseDashboardDateExpression("all", "2025-12-31", WIDE_BOUNDS), {
    startDate: "2024-01-01",
    endDate: "2025-12-31"
  });
});

test("parseDashboardDateExpression supports explicit single dates and explicit ranges", () => {
  assert.deepEqual(
    parseDashboardDateExpression("2025-11-30", "2025-12-31", WIDE_BOUNDS),
    {
      startDate: "2025-11-30",
      endDate: "2025-11-30"
    }
  );
  assert.deepEqual(
    parseDashboardDateExpression("2025-10-01 to 2025-11-30", "2025-12-31", WIDE_BOUNDS),
    {
      startDate: "2025-10-01",
      endDate: "2025-11-30"
    }
  );
});

test("parseDashboardDateExpression clamps parsed ranges to available bounds", () => {
  assert.deepEqual(parseDashboardDateExpression("90d", "2025-12-31", NARROW_BOUNDS), {
    startDate: "2025-12-01",
    endDate: "2025-12-31"
  });
  assert.deepEqual(
    parseDashboardDateExpression("2025-01-01 to 2026-01-01", "2025-12-31", NARROW_BOUNDS),
    {
      startDate: "2025-12-01",
      endDate: "2025-12-31"
    }
  );
});

test("parseDashboardDateExpression returns null for invalid expressions", () => {
  assert.equal(parseDashboardDateExpression("", "2025-12-31", WIDE_BOUNDS), null);
  assert.equal(parseDashboardDateExpression("0d", "2025-12-31", WIDE_BOUNDS), null);
  assert.equal(parseDashboardDateExpression("last week", "2025-12-31", WIDE_BOUNDS), null);
  assert.equal(parseDashboardDateExpression("30d", "2025-12-31", WIDE_BOUNDS), null);
  assert.equal(parseDashboardDateExpression("last 30 days", "2025-12-31", WIDE_BOUNDS), null);
  assert.equal(parseDashboardDateExpression("2025-13-01", "2025-12-31", WIDE_BOUNDS), null);
  assert.equal(parseDashboardDateExpression("banana", "2025-12-31", WIDE_BOUNDS), null);
});

test("buildDashboardDateQuickOptions returns predefined options with resolved ranges", () => {
  const options = buildDashboardDateQuickOptions("2025-12-31", NARROW_BOUNDS);
  const optionByKey = new Map(options.map((option) => [option.key, option]));

  assert.deepEqual(options.map((option) => option.key), [
    "last_90_days",
    "last_6_months",
    "last_12_months",
    "all_time"
  ]);
  assert.equal(optionByKey.has("last_week"), false);
  assert.equal(optionByKey.has("last_30_days"), false);
  assert.deepEqual(optionByKey.get("all_time")?.range, {
    startDate: "2025-12-01",
    endDate: "2025-12-31"
  });
});
