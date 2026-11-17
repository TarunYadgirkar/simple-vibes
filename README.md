# Simple Vibes

Simple Vibes reads how fast something vibrates using an ordinary webcam and a microphone, and flags when that frequency moves away from a healthy baseline. An agent then looks at the camera frame, says what changed, and writes a report from everything logged while nobody was watching.

Live: https://simple-vibes.vercel.app

Built at Agents after Dark (UC Berkeley, November 2026) for the computer vision track.

## Why it exists

A part that is loosening, cracking or carrying extra mass vibrates at a different frequency than it did when it was healthy. Measuring that normally means a contact sensor on every part. A camera pointed at the part can do the same job from a distance, with hardware people already own.

## How it works

1. **Track.** You drag a box around the part. Each frame, the box is collapsed to a one-dimensional profile of brightness edges, and that profile is matched against a reference to find how far the part moved, to a fraction of a pixel.
2. **Find the frequency.** The last 2.5 seconds of movement are detrended, windowed and run through a Fourier transform. The strongest peak is the vibration frequency. A reading only counts when the peak stands well clear of the noise.
3. **Compare.** You save one reading as the healthy baseline. Later readings within 5% are healthy, 5% to 15% are drifting, and beyond 15% is a fault.
4. **Look.** When a reading drifts, the agent receives the baseline photo and the current photo and writes what visibly changed.
5. **Listen.** The microphone runs through the same idea for sound, up to 24,000 Hz, including tones most adults cannot hear.
6. **Report.** The agent turns the whole log into a short maintenance report.

A webcam delivering 30 frames per second can read vibrations up to 15 Hz. The page shows the limit for the camera in use.

## Run it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The camera and microphone work without any setup. The agent features need an Anthropic API key in `.env.local`:

```
ANTHROPIC_API_KEY=your-key
```

To check the pipeline without a camera, choose the "test string" source. It draws a string plucked at 7.3 Hz and runs it through the same code as a real camera.

## What is verified

On synthetic frames of a vibrating line at 3.1, 7.3, 9.0 and 12.4 Hz, the tracker and spectrum code recover the frequency to within 0.01 Hz, including a movement of 0.3 pixels, and report nothing on noise alone.

## Limits

- Movement must be along one axis inside the box (up and down, or side to side).
- The camera must be still. Camera shake reads as vibration.
- Fast machinery needs a higher frame rate than a webcam provides.
- This is a one-night prototype. It has not been tested on real industrial equipment.

## Stack

Next.js, TypeScript and Tailwind. All tracking and signal processing runs in the browser. Claude writes the agent notes and the report.
