import assert from "node:assert/strict";
import test from "node:test";
import { initialLog, logReducer, type LogState, type Reading } from "../src/lib/monitor/log.ts";

const reading: Reading = { hz: 7.3, snr: 20, amplitudePx: 1, at: 1000 };

function withReading(): LogState {
  return logReducer(initialLog, { type: "reading", reading, note: null });
}

test("baseline saves the selected live reading instead of the last committed reading", () => {
  const live = { ...reading, hz: 10, at: 2000 };
  const state = logReducer(withReading(), { type: "setBaseline", reading: live, image: "live-frame" });
  assert.deepEqual(state.baseline, live);
  assert.equal(state.baselineImage, "live-frame");
  assert.deepEqual(state.last, reading);
});

test("measurement context reset invalidates baseline and last reading while keeping history", () => {
  const baseline = logReducer(withReading(), { type: "setBaseline", reading, image: "baseline-frame" });
  const state = logReducer(baseline, { type: "resetMeasurement" });
  assert.equal(state.baseline, null);
  assert.equal(state.baselineImage, null);
  assert.equal(state.last, null);
  assert.deepEqual(state.events, baseline.events);
});

test("camera diagnosis only changes vibration event sharing a timestamp with microphone events", () => {
  let state = withReading();
  state = logReducer(state, { type: "tone", hz: 12000, levelDb: -40, snrDb: 40, at: reading.at });
  state = logReducer(state, { type: "hum", id: reading.at, hz: 120, harmonics: 4 });
  const humNote = state.events[0].note;
  state = logReducer(state, { type: "note", kind: "vibration", id: reading.at, note: "camera diagnosis" });
  assert.equal(state.events.find((event) => event.kind === "vibration")?.note, "camera diagnosis");
  assert.equal(state.events.find((event) => event.kind === "tone")?.note, null);
  assert.equal(state.events.find((event) => event.kind === "hum")?.note, humNote);
});

test("hum completion only changes the hum event sharing a timestamp", () => {
  let state = withReading();
  state = logReducer(state, { type: "tone", hz: 12000, levelDb: -40, snrDb: 40, at: reading.at });
  state = logReducer(state, { type: "hum", id: reading.at, hz: 120, harmonics: 4 });
  state = logReducer(state, { type: "note", kind: "hum", id: reading.at, note: "steady hum, lasted 5 s" });
  assert.equal(state.events.find((event) => event.kind === "hum")?.note, "steady hum, lasted 5 s");
  assert.equal(state.events.find((event) => event.kind === "vibration")?.note, null);
  assert.equal(state.events.find((event) => event.kind === "tone")?.note, null);
});
