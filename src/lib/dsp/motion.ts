export type Axis = "vertical" | "horizontal";

const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

// Collapses the watch box to a 1D brightness-edge profile along the motion axis.
// Edges (not raw brightness) keep the estimate stable when the lighting flickers.
export function edgeProfile(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  axis: Axis,
): Float64Array {
  const length = axis === "vertical" ? height : width;
  const across = axis === "vertical" ? width : height;
  const sums = new Float64Array(length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luma = LUMA_R * pixels[i] + LUMA_G * pixels[i + 1] + LUMA_B * pixels[i + 2];
      sums[axis === "vertical" ? y : x] += luma;
    }
  }

  const profile = new Float64Array(length);
  for (let i = 1; i < length - 1; i++) {
    profile[i] = (sums[i + 1] - sums[i - 1]) / (2 * across);
  }
  return profile;
}

// Sub-pixel displacement of `current` against `reference`, in profile pixels.
export function estimateShift(
  reference: Float64Array,
  current: Float64Array,
  maxLag: number,
): number {
  const start = maxLag;
  const end = reference.length - maxLag;
  const scores = new Float64Array(2 * maxLag + 1);

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let dot = 0;
    let energy = 0;
    for (let i = start; i < end; i++) {
      const value = current[i + lag];
      dot += reference[i] * value;
      energy += value * value;
    }
    scores[lag + maxLag] = energy > 0 ? dot / Math.sqrt(energy) : 0;
  }

  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[best]) best = i;
  }
  if (best === 0 || best === scores.length - 1) return best - maxLag;

  const left = scores[best - 1];
  const centre = scores[best];
  const right = scores[best + 1];
  const curvature = left - 2 * centre + right;
  const offset = curvature === 0 ? 0 : (0.5 * (left - right)) / curvature;
  return best - maxLag + offset;
}
