# Simple Vibes

Reads vibration frequency from a webcam and a microphone. Flags when it drifts from a baseline. An agent looks at the frame and says what changed.

Live: https://simple-vibes.vercel.app

Built at Agents after Dark, UC Berkeley, Nov 2026. Computer vision track.

## How it works

1. Drag a box around the part. Each frame, the box becomes a 1D profile of brightness edges. Cross-correlating it against a reference gives the displacement to a fraction of a pixel.
2. The last 2.5 s of displacement is detrended, windowed and Fourier transformed. The strongest peak is the frequency. Peaks that don't clear the noise floor are dropped.
3. One reading is saved as the baseline. Within 5% is healthy, 5 to 15% is drifting, past 15% is a fault.
4. On drift, Claude gets the baseline photo and the current photo and writes what changed.
5. The mic does the same for sound up to 24 kHz.
6. Claude writes a report from the log.

A 30 fps webcam reads up to 15 Hz.

## Run

```bash
pnpm install
pnpm dev
```

Agent features need `ANTHROPIC_API_KEY` in `.env.local`.

## Tested

Synthetic frames of a line vibrating at 3.1, 7.3, 9.0 and 12.4 Hz: frequency recovered within 0.01 Hz, down to 0.3 px of movement. Nothing reported on noise alone.

## Limits

- Motion along one axis only.
- The camera has to be still.
- Fast machinery needs more frames per second than a webcam gives.
- One-night prototype. Not tested on industrial equipment.

## Stack

Next.js, TypeScript, Tailwind. Tracking and signal processing run in the browser.
