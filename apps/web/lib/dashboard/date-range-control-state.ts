import type { DashboardDateRange } from "./date-range";
import type { DashboardDateQuickOption } from "./date-range-shortcuts";

export function resolveActiveDateQuickOptionKey(
  quickOptions: DashboardDateQuickOption[],
  range: DashboardDateRange
): string | null {
  const activeOption = quickOptions.find(
    (option) =>
      option.range.startDate === range.startDate && option.range.endDate === range.endDate
  );

  return activeOption?.key ?? null;
}
