import { z } from "zod";

export const JPEG_PREFIX = "data:image/jpeg;base64,";
const MAX_IMAGE_CHARS = 700_000;

const frameSchema = z.string().startsWith(JPEG_PREFIX).max(MAX_IMAGE_CHARS);

export const diagnoseRequestSchema = z.object({
  assetName: z.string().trim().min(1).max(80),
  baselineHz: z.number().positive().finite(),
  hz: z.number().positive().finite(),
  deviationPct: z.number().finite(),
  baselineImage: frameSchema,
  currentImage: frameSchema,
});

export type DiagnoseRequest = z.infer<typeof diagnoseRequestSchema>;
export type DiagnoseResponse = { note: string } | { error: string };

export const LOOKING_NOTE = "agent is looking at the camera frame";
const UNREACHABLE_NOTE = "agent could not be reached for this reading";

export async function fetchDiagnosis(body: DiagnoseRequest): Promise<string> {
  try {
    const response = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as DiagnoseResponse;
    return "note" in result ? result.note : result.error;
  } catch {
    return UNREACHABLE_NOTE;
  }
}
