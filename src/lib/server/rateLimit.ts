const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_TRACKED_CLIENTS = 5000;

const recent = new Map<string, number[]>();

// Per-instance memory only: enough to stop one visitor draining the API key, not a hard quota.
export function isRateLimited(request: Request): boolean {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const hits = (recent.get(client) ?? []).filter((at) => now - at < WINDOW_MS);
  if (hits.length >= MAX_REQUESTS_PER_WINDOW) return true;
  if (recent.size >= MAX_TRACKED_CLIENTS && !recent.has(client)) {
    for (const [key, times] of recent) {
      if (now - times[times.length - 1] >= WINDOW_MS) recent.delete(key);
    }
    if (recent.size >= MAX_TRACKED_CLIENTS) return true;
  }
  recent.set(client, [...hits, now]);
  return false;
}
