import { dashboardSegmentSchema, type DashboardSegment, zipCodeSchema } from "@zipmarket/shared";
import { z } from "zod";

export const DASHBOARD_DISCLAIMER =
  "This dashboard is based on closed sales and aggregated market data. It is not a live listings feed and does not reflect currently active homes.";
export const DASHBOARD_SOURCE = "Redfin Data Center";
export const DASHBOARD_WINDOW_TYPE = "rolling_monthly_aggregates";
export const DASHBOARD_UNSUPPORTED_MESSAGE = "Data not available yet";
export const MAX_SUGGESTIONS = 5;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dashboardQuerySchema = z.object({
  segment: dashboardSegmentSchema.default("all"),
  months: z.coerce.number().int().min(12).max(36).default(36)
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const suggestionSchema = z.object({
  zip: zipCodeSchema,
  distance_miles: z.number().nonnegative()
});

export type ZipSuggestion = z.infer<typeof suggestionSchema>;

const dashboardSeriesSchema = z
  .object({
    period_end: z.array(isoDateSchema),
    median_sale_price: z.array(z.number().nullable()),
    median_list_price: z.array(z.number().nullable()),
    avg_sale_to_list: z.array(z.number().nullable()),
    sold_above_list: z.array(z.number().nullable()),
    new_listings: z.array(z.number().nullable()),
    homes_sold: z.array(z.number().nullable())
  })
  .superRefine((value, context) => {
    const expectedLength = value.period_end.length;
    for (const [seriesName, seriesValues] of Object.entries(value)) {
      if (seriesName === "period_end") {
        continue;
      }

      if (seriesValues.length !== expectedLength) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [seriesName],
          message: `Series "${seriesName}" length must match period_end length.`
        });
      }
    }
  });

const dashboardKpiValueSchema = z.object({
  value: z.number().nullable(),
  yoy_change: z.number().nullable(),
  mom_change: z.number().nullable()
});

export const dashboardSupportedResponseSchema = z.object({
  zip: zipCodeSchema,
  status: z.literal("supported"),
  segment: dashboardSegmentSchema,
  latest_period_end: isoDateSchema,
  kpis: z.object({
    median_list_price: dashboardKpiValueSchema,
    median_sale_price: dashboardKpiValueSchema,
    sale_to_list_ratio: z.object({
      value: z.number().nullable(),
      over_under_pct: z.number().nullable(),
      yoy_change: z.number().nullable()
    }),
    sold_over_list_pct: z.object({
      value_pct: z.number().nullable(),
      yoy_change: z.number().nullable()
    }),
    new_listings: z.object({
      value: z.number().nullable(),
      yoy_change: z.number().nullable()
    }),
    homes_sold: z.object({
      value: z.number().nullable(),
      yoy_change: z.number().nullable()
    })
  }),
  series: dashboardSeriesSchema,
  competitiveness: z.object({
    score: z.number().int().nullable(),
    label: z.string().nullable(),
    explanation: z.string().nullable(),
    confidence_tier: z.string().nullable()
  }),
  disclaimer: z.literal(DASHBOARD_DISCLAIMER),
  methodology: z.object({
    source: z.literal(DASHBOARD_SOURCE),
    last_updated: z.string().datetime().nullable(),
    window_type: z.literal(DASHBOARD_WINDOW_TYPE)
  })
});

export type DashboardSupportedResponse = z.infer<typeof dashboardSupportedResponseSchema>;

export const dashboardUnsupportedResponseSchema = z.object({
  zip: zipCodeSchema,
  status: z.literal("unsupported"),
  message: z.literal(DASHBOARD_UNSUPPORTED_MESSAGE),
  nearby_supported_zips: z.array(suggestionSchema).max(MAX_SUGGESTIONS)
});

export type DashboardUnsupportedResponse = z.infer<typeof dashboardUnsupportedResponseSchema>;

export const dashboardResponseSchema = z.union([
  dashboardSupportedResponseSchema,
  dashboardUnsupportedResponseSchema
]);

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const zipSuggestionsResponseSchema = z.object({
  zip: zipCodeSchema,
  suggestions: z.array(suggestionSchema).max(MAX_SUGGESTIONS)
});

export type ZipSuggestionsResponse = z.infer<typeof zipSuggestionsResponseSchema>;

export const apiErrorCodeSchema = z.enum([
  "INVALID_ZIP",
  "INVALID_QUERY",
  "ZIP_NOT_FOUND",
  "NON_NJ_ZIP",
  "INTERNAL_ERROR"
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.unknown()).optional()
  })
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;

export interface DashboardLookupInput {
  zip: string;
  segment: DashboardSegment;
  months: number;
}
