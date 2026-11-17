export function magnitudeSpectrum(signal: Float64Array): Float64Array {
  const n = signal.length;
  const re = Float64Array.from(signal);
  const im = new Float64Array(n);

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const swap = re[i];
      re[i] = re[j];
      re[j] = swap;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const stepRe = Math.cos(angle);
    const stepIm = Math.sin(angle);
    const half = len >> 1;
    for (let start = 0; start < n; start += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const tRe = re[b] * wRe - im[b] * wIm;
        const tIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextRe = wRe * stepRe - wIm * stepIm;
        wIm = wRe * stepIm + wIm * stepRe;
        wRe = nextRe;
      }
    }
  }

  const mags = new Float64Array(n >> 1);
  for (let i = 0; i < mags.length; i++) mags[i] = Math.hypot(re[i], im[i]);
  return mags;
}

export function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}
