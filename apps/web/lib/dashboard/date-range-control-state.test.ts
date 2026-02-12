import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardDateQuickOption } from "./date-range-shortcuts";
import { resolveActiveDateQuickOptionKey } from "./date-range-control-state";

const QUICK_OPTIONS: DashboardDateQuickOption[] = [
  {
    key: "last_90_days",
    label: "90 days",
    expression: "90d",
    range: {
      startDate: "2025-10-02",
      endDate: "2025-12-31"
    }
  },
  {
    key: "all_time",
    label: "All time",
    expression: "all",
    range: {
      startDate: "2024-01-01",
      endDate: "2025-12-31"
    }
  }
];

test("resolveActiveDateQuickOptionKey returns matching preset key", () => {
  assert.equal(
    resolveActiveDateQuickOptionKey(QUICK_OPTIONS, {
      startDate: "2024-01-01",
      endDate: "2025-12-31"
    }),
    "all_time"
  );
});

test("resolveActiveDateQuickOptionKey falls back to custom for unmatched ranges", () => {
  assert.equal(
    resolveActiveDateQuickOptionKey(QUICK_OPTIONS, {
      startDate: "2025-11-01",
      endDate: "2025-12-15"
    }),
    null
  );
});
