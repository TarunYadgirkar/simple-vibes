export interface ToneEstimate {
  hz: number;
  levelDb: number;
  snrDb: number;
}

const SNR_LOCK_DB = 12;
const MIN_LEVEL_DB = -105;
const FLOOR_SAMPLE_STEP = 8;

// Loudest narrow tone in a dB spectrum, or null when nothing stands clear of the noise floor.
export function findTone(bins: Float32Array, binHz: number, minHz: number): ToneEstimate | null {
  const minBin = Math.max(1, Math.ceil(minHz / binHz));
  let peak = minBin;
  const sampled: number[] = [];
  for (let i = minBin; i < bins.length - 1; i++) {
    if (bins[i] > bins[peak]) peak = i;
    if (i % FLOOR_SAMPLE_STEP === 0) sampled.push(bins[i]);
  }
  if (sampled.length === 0) return null;

  const floor = sampled.sort((a, b) => a - b)[sampled.length >> 1];
  const snrDb = bins[peak] - floor;
  if (snrDb < SNR_LOCK_DB || bins[peak] < MIN_LEVEL_DB) return null;

  const left = bins[peak - 1];
  const centre = bins[peak];
  const right = bins[peak + 1];
  const curvature = left - 2 * centre + right;
  const offset = curvature === 0 ? 0 : (0.5 * (left - right)) / curvature;
  return { hz: (peak + offset) * binHz, levelDb: centre, snrDb };
}

const PLOT_FLOOR_DB = -110;
const PLOT_CEILING_DB = -20;

export function toPlotPoints(bins: Float32Array, pointCount: number): number[] {
  const perPoint = bins.length / pointCount;
  return Array.from({ length: pointCount }, (_, point) => {
    let loudest = -Infinity;
    const end = Math.floor((point + 1) * perPoint);
    for (let i = Math.floor(point * perPoint); i < end; i++) loudest = Math.max(loudest, bins[i]);
    const height = (loudest - PLOT_FLOOR_DB) / (PLOT_CEILING_DB - PLOT_FLOOR_DB);
    return Math.min(1, Math.max(0, height));
  });
}

export interface HumEstimate {
  hz: number;
  harmonics: number;
}

const HUM_MIN_HZ = 60;
const HUM_MAX_HZ = 400;
const HUM_STEP_HZ = 1;
const HUM_HARMONICS = 8;
const HUM_ANALYSIS_MAX_HZ = 4000;
const HUM_PROMINENCE_DB = 12;
const HUM_MIN_LEVEL_DB = -85;
const HUM_MIN_HARMONICS = 4;
const HUM_TOLERANCE = 0.015;
const FLOOR_BLOCK_BINS = 32;

function blockFloors(bins: Float32Array, lastBin: number): number[] {
  const floors: number[] = [];
  for (let start = 0; start <= lastBin; start += FLOOR_BLOCK_BINS) {
    const block = Array.from(bins.subarray(start, start + FLOOR_BLOCK_BINS)).sort((a, b) => a - b);
    floors.push(block[block.length >> 1]);
  }
  return floors;
}

// A hum is a sound with evenly spaced overtones (engines, rotors, motors), unlike a single tone or hiss.
// The fundamental itself may be missing, as it is through a small speaker, so any 4 of 8 overtones count.
export function findHum(bins: Float32Array, binHz: number): HumEstimate | null {
  const lastBin = Math.min(bins.length - 2, Math.ceil(HUM_ANALYSIS_MAX_HZ / binHz));
  const floors = blockFloors(bins, lastBin);

  const peakNear = (hz: number): { bin: number; prominence: number } => {
    const centre = hz / binHz;
    const reach = Math.max(1, centre * HUM_TOLERANCE);
    let bin = Math.max(1, Math.floor(centre - reach));
    for (let i = bin; i <= Math.min(lastBin, Math.ceil(centre + reach)); i++) {
      if (bins[i] > bins[bin]) bin = i;
    }
    const floor = floors[Math.min(floors.length - 1, Math.floor(bin / FLOOR_BLOCK_BINS))];
    return { bin, prominence: bins[bin] - floor };
  };

  let best: { f0: number; count: number; topHarmonic: number; topBin: number } | null = null;
  for (let f0 = HUM_MIN_HZ; f0 <= HUM_MAX_HZ; f0 += HUM_STEP_HZ) {
    let count = 0;
    let topHarmonic = 0;
    let topBin = 0;
    for (let k = 1; k <= HUM_HARMONICS && k * f0 <= HUM_ANALYSIS_MAX_HZ; k++) {
      const { bin, prominence } = peakNear(k * f0);
      if (prominence < HUM_PROMINENCE_DB || bins[bin] < HUM_MIN_LEVEL_DB) continue;
      count += 1;
      topHarmonic = k;
      topBin = bin;
    }
    if (count >= HUM_MIN_HARMONICS && (!best || count > best.count)) {
      best = { f0, count, topHarmonic, topBin };
    }
  }
  if (!best) return null;

  const left = bins[best.topBin - 1];
  const centre = bins[best.topBin];
  const right = bins[best.topBin + 1];
  const curvature = left - 2 * centre + right;
  const offset = curvature === 0 ? 0 : (0.5 * (left - right)) / curvature;
  return { hz: ((best.topBin + offset) * binHz) / best.topHarmonic, harmonics: best.count };
}
