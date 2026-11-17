import type { Spectrum } from "./spectrum";

const FFT_SIZE = 256;
const MIN_FRAMES = 45;
const MIN_HZ = 1.5;
const MIN_PIXEL_SPREAD = 1.5;
const VOTE_SHARE = 0.08;
const OCTAVE_SHARE = 0.35;

const cosTable = new Float64Array(FFT_SIZE / 2);
const sinTable = new Float64Array(FFT_SIZE / 2);
for (let i = 0; i < FFT_SIZE / 2; i++) {
  cosTable[i] = Math.cos((-2 * Math.PI * i) / FFT_SIZE);
  sinTable[i] = Math.sin((-2 * Math.PI * i) / FFT_SIZE);
}
const re = new Float64Array(FFT_SIZE);
const im = new Float64Array(FFT_SIZE);

function fftInPlace(): void {
  for (let i = 1, j = 0; i < FFT_SIZE; i++) {
    let bit = FFT_SIZE >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const swap = re[i];
      re[i] = re[j];
      re[j] = swap;
    }
  }
  for (let len = 2; len <= FFT_SIZE; len <<= 1) {
    const half = len >> 1;
    const stride = FFT_SIZE / len;
    for (let start = 0; start < FFT_SIZE; start += len) {
      for (let k = 0; k < half; k++) {
        const wRe = cosTable[k * stride];
        const wIm = sinTable[k * stride];
        const a = start + k;
        const b = a + half;
        const tRe = re[b] * wRe - im[b] * wIm;
        const tIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
      }
    }
  }
}

// Every pixel in the watch box gets its own brightness-over-time spectrum, normalised so each pixel
// has one vote. A vibrating part makes its pixels flicker at one shared frequency, so their votes
// pile up there, while a person shifting behind it only adds slow, scattered energy.
export function analyzeGrid(frames: Float32Array[], times: number[]): Spectrum | null {
  const n = Math.min(frames.length, FFT_SIZE);
  if (n < MIN_FRAMES) return null;
  const used = frames.slice(-n);
  const duration = times[times.length - 1] - times[times.length - n];
  if (duration <= 0) return null;

  const sampleRate = (n - 1) / duration;
  const binHz = sampleRate / FFT_SIZE;
  const bins = FFT_SIZE / 2;
  const minBin = Math.max(2, Math.ceil(MIN_HZ / binHz));
  const pixels = used[0].length;
  const votes = new Float64Array(bins);
  const power = new Float64Array(bins);
  const meanIndex = (n - 1) / 2;
  let indexVariance = 0;
  for (let i = 0; i < n; i++) indexVariance += (i - meanIndex) ** 2;

  let voters = 0;
  let strongest = -1;
  let strongestPower = 0;
  const shares: Float64Array[] = [];
  const voterPixels: number[] = [];

  for (let p = 0; p < pixels; p++) {
    let mean = 0;
    for (let i = 0; i < n; i++) mean += used[i][p];
    mean /= n;
    let covariance = 0;
    let spread = 0;
    for (let i = 0; i < n; i++) {
      const centred = used[i][p] - mean;
      covariance += (i - meanIndex) * centred;
      spread += centred * centred;
    }
    if (Math.sqrt(spread / n) < MIN_PIXEL_SPREAD) continue;

    const slope = covariance / indexVariance;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < n; i++) {
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
      re[i] = (used[i][p] - mean - slope * (i - meanIndex)) * hann;
    }
    fftInPlace();

    let total = 0;
    for (let k = 1; k < bins; k++) {
      power[k] = re[k] * re[k] + im[k] * im[k];
      total += power[k];
    }
    if (total <= 0) continue;
    const share = new Float64Array(bins);
    for (let k = minBin; k < bins; k++) {
      share[k] = power[k] / total;
      votes[k] += share[k];
    }
    shares.push(share);
    voterPixels.push(p);
    voters += 1;
  }
  if (voters === 0) return null;

  let peak = minBin;
  for (let k = minBin; k < bins - 1; k++) if (votes[k] > votes[peak]) peak = k;

  // A pixel the part sweeps across twice per swing flickers at double the true rate.
  const halfBin = Math.round(peak / 2);
  if (halfBin >= minBin) {
    let halfPeak = halfBin;
    for (let k = halfBin - 1; k <= halfBin + 1; k++) if (votes[k] > votes[halfPeak]) halfPeak = k;
    if (votes[halfPeak] >= OCTAVE_SHARE * votes[peak]) peak = halfPeak;
  }

  let agreeing = 0;
  shares.forEach((share, i) => {
    const here = share[peak - 1] + share[peak] + share[peak + 1];
    if (here < VOTE_SHARE) return;
    agreeing += 1;
    if (here > strongestPower) {
      strongestPower = here;
      strongest = voterPixels[i];
    }
  });

  const sorted = Float64Array.from(votes.subarray(minBin)).sort();
  const floor = sorted[sorted.length >> 1];
  const left = votes[peak - 1];
  const centre = votes[peak];
  const right = votes[peak + 1];
  const curvature = left - 2 * centre + right;
  const offset = curvature === 0 ? 0 : (0.5 * (left - right)) / curvature;

  const detrended =
    strongest < 0
      ? []
      : (() => {
          const series = used.map((frame) => frame[strongest]);
          const mean = series.reduce((sum, v) => sum + v, 0) / series.length;
          return series.map((v) => v - mean);
        })();

  return {
    mags: votes,
    binHz,
    peakHz: (peak + offset) * binHz,
    snr: floor > 0 ? centre / floor : 0,
    amplitude: (100 * agreeing) / pixels,
    sampleRate,
    detrended,
  };
}
