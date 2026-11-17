import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { JPEG_PREFIX } from "../../../lib/monitor/diagnose";
import { errorResponse } from "../../../lib/server/claude";

const MAX_BODY_CHARS = 800_000;
const DATA_DIR = path.join(process.cwd(), ".data");

const telemetrySchema = z.object({
  kind: z.enum(["event", "status", "frame"]),
  at: z.number().int().positive(),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") return errorResponse("Not available.", 404);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return errorResponse("Requests must be sent as JSON.", 415);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return errorResponse("Telemetry entry is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse("Telemetry entry is not valid JSON.", 400);
  }
  const parsed = telemetrySchema.safeParse(body);
  if (!parsed.success) return errorResponse("Telemetry entry has the wrong shape.", 400);

  await mkdir(DATA_DIR, { recursive: true });
  const { kind, data } = parsed.data;
  if (kind === "frame") {
    const image = data.image;
    if (typeof image !== "string" || !image.startsWith(JPEG_PREFIX)) {
      return errorResponse("Frame must be a JPEG data URL.", 400);
    }
    await writeFile(path.join(DATA_DIR, "frame.jpg"), Buffer.from(image.slice(JPEG_PREFIX.length), "base64"));
  } else {
    await appendFile(path.join(DATA_DIR, "telemetry.jsonl"), `${JSON.stringify(parsed.data)}\n`);
  }
  return Response.json({ ok: true });
}
