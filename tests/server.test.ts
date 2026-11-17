import assert from "node:assert/strict";
import { test } from "node:test";
import { isRateLimited } from "../src/lib/server/rateLimit.ts";
import { fetchDiagnosis } from "../src/lib/monitor/diagnose.ts";

const requestFor = (client: string) => new Request("http://localhost/api/report", {
  headers: { "x-forwarded-for": client },
});

test("rejected requests do not consume the next window's quota", (t) => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const request = requestFor("quota-test");
  for (let i = 0; i < 30; i++) assert.equal(isRateLimited(request), false);
  now += 1000;
  for (let i = 0; i < 2000; i++) assert.equal(isRateLimited(request), true);
  now += 599_001;
  for (let i = 0; i < 30; i++) assert.equal(isRateLimited(request), false);
  assert.equal(isRateLimited(request), true);
});

test("new clients cannot erase active limits when client capacity is reached", (t) => {
  t.mock.method(Date, "now", () => 10_000_000);
  const limited = requestFor("protected-client");
  for (let i = 0; i < 30; i++) isRateLimited(limited);
  for (let i = 0; i < 5000; i++) isRateLimited(requestFor(`capacity-${i}`));
  assert.equal(isRateLimited(limited), true);
  assert.equal(isRateLimited(requestFor("overflow-client")), true);
});

test("expired clients free capacity", (t) => {
  t.mock.method(Date, "now", () => 11_000_000);
  assert.equal(isRateLimited(requestFor("new-window-client")), false);
});

test("malformed diagnosis responses produce a usable error note", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ unexpected: true }));
  const note = await fetchDiagnosis({
    assetName: "Cable", baselineHz: 7, hz: 6, deviationPct: -14,
    baselineImage: "data:image/jpeg;base64,AA==", currentImage: "data:image/jpeg;base64,AA==",
  });
  assert.equal(typeof note, "string");
  assert.ok(note.length > 0 && note.length <= 600);
});

test("long diagnosis responses cannot invalidate the report log", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ note: "x".repeat(601) }));
  const note = await fetchDiagnosis({
    assetName: "Cable", baselineHz: 7, hz: 6, deviationPct: -14,
    baselineImage: "data:image/jpeg;base64,AA==", currentImage: "data:image/jpeg;base64,AA==",
  });
  assert.ok(note.length > 0 && note.length <= 600);
});
