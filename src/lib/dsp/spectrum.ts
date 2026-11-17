import { magnitudeSpectrum, nextPowerOfTwo } from "./fft";

export interface Sample {
  t: number;
  x: number;
}

export interface Spectrum {
  mags: Float64Array;
  binHz: number;
  peakHz: number;
  snr: number;
  amplitude: number;
  sampleRate: number;
  detrended: number[];
}

const MIN_SAMPLES = 24;
const MIN_HZ = 1;
const PAD_FACTOR = 8;

function resample(samples: Sample[], count: number): Float64Array {
  const t0 = samples[0].t;
  const step = (samples[samples.length - 1].t - t0) / (count - 1);
  const out = new Float64Array(count);
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const t = t0 + i * step;
    while (cursor < samples.length - 2 && samples[cursor + 1].t < t) cursor++;
    const a = samples[cursor];
    const b = samples[cursor + 1];
    const span = b.t - a.t;
    const mix = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
    out[i] = a.x + (b.x - a.x) * mix;
  }
  return out;
}

function removeTrend(values: Float64Array): Float64Array {
  const n = values.length;
  const meanIndex = (n - 1) / 2;
  let meanValue = 0;
  for (let i = 0; i < n; i++) meanValue += values[i];
  meanValue /= n;

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (i - meanIndex) * (values[i] - meanValue);
    variance += (i - meanIndex) ** 2;
  }
  const slope = variance > 0 ? covariance / variance : 0;
  return values.map((value, i) => value - meanValue - slope * (i - meanIndex));
}

function median(values: Float64Array): number {
  const sorted = Float64Array.from(values).sort();
  return sorted[sorted.length >> 1];
}

export function analyze(samples: Sample[]): Spectrum | null {
  const n = samples.length;
  if (n < MIN_SAMPLES) return null;
  const duration = samples[n - 1].t - samples[0].t;
  if (duration <= 0) return null;

  const sampleRate = (n - 1) / duration;
  const detrended = removeTrend(resample(samples, n));
  const amplitude = Math.sqrt(detrended.reduce((sum, v) => sum + v * v, 0) / n);

  const size = nextPowerOfTwo(n) * PAD_FACTOR;
  const padded = new Float64Array(size);
  for (let i = 0; i < n; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    padded[i] = detrended[i] * hann;
  }

  const mags = magnitudeSpectrum(padded);
  const binHz = sampleRate / size;
  const minBin = Math.max(1, Math.ceil(MIN_HZ / binHz));

  let peak = minBin;
  for (let i = minBin; i < mags.length - 1; i++) {
    if (mags[i] > mags[peak]) peak = i;
  }

  const left = mags[peak - 1];
  const centre = mags[peak];
  const right = mags[peak + 1];
  const curvature = left - 2 * centre + right;
  const offset = curvature === 0 ? 0 : (0.5 * (left - right)) / curvature;
  const floor = median(mags.subarray(minBin));

  return {
    mags,
    binHz,
    peakHz: (peak + offset) * binHz,
    snr: floor > 0 ? centre / floor : 0,
    amplitude,
    sampleRate,
    detrended: Array.from(detrended),
  };
}
