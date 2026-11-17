import assert from "node:assert/strict";
import test from "node:test";
import { findHum, findTone, toPlotPoints } from "../src/lib/dsp/tone.ts";

const BIN_HZ = 48000 / 16384;

function harmonicSpectrum(fundamental: number, floor = -Infinity): Float32Array {
  const bins = new Float32Array(8192).fill(floor);
  for (let harmonic = 1; harmonic <= 8; harmonic++) {
    bins[Math.round((fundamental * harmonic) / BIN_HZ)] = -40;
  }
  return bins;
}

test("isolated tone amid silent bins has finite frequency and SNR", () => {
  const bins = new Float32Array(8192).fill(-Infinity);
  bins[4096] = -40;
  const tone = findTone(bins, BIN_HZ, 10000);
  assert.ok(tone);
  assert.equal(tone.hz, 12000);
  assert.ok(Number.isFinite(tone.snrDb));
});

test("hum amid silent bins has a finite fundamental", () => {
  const hum = findHum(harmonicSpectrum(120), BIN_HZ);
  assert.ok(hum);
  assert.ok(Number.isFinite(hum.hz));
  assert.ok(Math.abs(hum.hz - 120) < 1);
  assert.equal(hum.harmonics, 8);
});

test("silence produces neither tone nor hum", () => {
  const bins = new Float32Array(8192).fill(-Infinity);
  assert.equal(findTone(bins, BIN_HZ, 10000), null);
  assert.equal(findHum(bins, BIN_HZ), null);
  assert.ok(toPlotPoints(bins, 512).every((point) => point === 0));
});

test("weak harmonic noise still fails hum loudness threshold", () => {
  const bins = harmonicSpectrum(120, -110);
  for (let harmonic = 1; harmonic <= 8; harmonic++) {
    bins[Math.round((120 * harmonic) / BIN_HZ)] = -90;
  }
  assert.equal(findHum(bins, BIN_HZ), null);
});

test("finite neighboring bins retain sub-bin tone interpolation", () => {
  const bins = new Float32Array(8192).fill(-110);
  bins[4095] = -60;
  bins[4096] = -40;
  bins[4097] = -50;
  const tone = findTone(bins, BIN_HZ, 10000);
  assert.ok(tone);
  assert.ok(Math.abs(tone.hz - (4096 + 1 / 6) * BIN_HZ) < 1e-6);
  assert.equal(tone.snrDb, 70);
});
