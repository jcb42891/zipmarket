import { z } from "zod";

export const ZIP_CODE_REGEX = /^\d{5}$/;
export const NJ_STATE_CODE = "NJ";

export const zipCodeSchema = z
  .string()
  .regex(ZIP_CODE_REGEX, "ZIP code must be exactly 5 digits.");

export const dashboardSegmentSchema = z.enum([
  "all",
  "single_family",
  "condo_coop",
  "townhouse"
]);

export type DashboardSegment = z.infer<typeof dashboardSegmentSchema>;

