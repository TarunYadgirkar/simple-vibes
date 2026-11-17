import { z } from "zod";

const MAX_REPORT_EVENTS = 500;

export const reportRequestSchema = z.object({
  assetName: z.string().trim().min(1).max(80),
  baselineHz: z.number().positive().finite().nullable(),
  events: z
    .array(
      z.object({
        time: z.string().min(1).max(40),
        sensor: z.enum(["camera", "mic"]),
        kind: z.enum(["vibration", "tone", "hum"]),
        levelDb: z.number().finite().nullable(),
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
