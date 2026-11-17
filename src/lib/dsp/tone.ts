export interface ToneEstimate {
  hz: number;
  levelDb: number;
  snrDb: number;
}

const SNR_LOCK_DB = 25;
const MIN_LEVEL_DB = -90;
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
