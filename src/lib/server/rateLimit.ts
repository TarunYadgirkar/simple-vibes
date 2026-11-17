const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_TRACKED_CLIENTS = 5000;

const recent = new Map<string, number[]>();

// Per-instance memory only: enough to stop one visitor draining the API key, not a hard quota.
export function isRateLimited(request: Request): boolean {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const hits = [...(recent.get(client) ?? []).filter((at) => now - at < WINDOW_MS), now];
  if (recent.size >= MAX_TRACKED_CLIENTS && !recent.has(client)) recent.clear();
  recent.set(client, hits);
  return hits.length > MAX_REQUESTS_PER_WINDOW;
}
