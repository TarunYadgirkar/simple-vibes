export type TelemetryKind = "event" | "status" | "frame";

// Local debugging aid only: a failed send must never interrupt the live reading loop.
export function sendTelemetry(kind: TelemetryKind, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, at: Date.now(), data }),
  }).catch(() => undefined);
}
