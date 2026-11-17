import { z } from "zod";

const MAX_REPORT_EVENTS = 500;

export const reportRequestSchema = z.object({
  assetName: z.string().trim().min(1).max(80),
  baselineHz: z.number().positive().finite().nullable(),
  timeZone: z.string().regex(/^[A-Za-z0-9_+\-\/]{1,64}$/),
  events: z
    .array(
      z.object({
        at: z.number().int().positive(),
        hz: z.number().positive().finite(),
        deviationPct: z.number().finite().nullable(),
        amplitudePx: z.number().nonnegative().finite(),
        health: z.enum(["unknown", "healthy", "drift", "fault"]),
        note: z.string().max(600).nullable(),
      }),
    )
    .min(1)
    .max(MAX_REPORT_EVENTS),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export type ReportResponse = { report: string } | { error: string };
