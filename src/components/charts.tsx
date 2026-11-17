"use client";

import { useEffect, useRef } from "react";
import type { Spectrum } from "../lib/dsp/spectrum";

type Painter = (ctx: CanvasRenderingContext2D, width: number, height: number, color: (name: string) => string) => void;

function useCanvas(paint: Painter) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    const styles = getComputedStyle(canvas);
    paint(ctx, width, height, (name) => styles.getPropertyValue(name).trim());
  });
  return ref;
}

const MIN_WAVE_SPAN_PX = 1;

export function WaveChart({ wave }: { wave: number[] }) {
  const ref = useCanvas((ctx, width, height, color) => {
    ctx.strokeStyle = color("--line");
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    if (wave.length < 2) return;

    const span = Math.max(MIN_WAVE_SPAN_PX, ...wave.map(Math.abs));
    ctx.strokeStyle = color("--ink");
    ctx.lineWidth = 2;
    ctx.beginPath();
    wave.forEach((value, i) => {
      const x = (i / (wave.length - 1)) * width;
      const y = height / 2 + (value / span) * (height / 2 - 6);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  return <canvas ref={ref} className="h-32 w-full" aria-label="Displacement of the watched part over the last few seconds" />;
}

type PlotProps = {
  points: number[];
  maxHz: number;
  tickStepHz: number;
  formatTick: (hz: number) => string;
  baselineHz: number | null;
  markerHz: number | null;
  label: string;
};

const AXIS_HEIGHT = 22;
const TOP_GAP = 4;

function SpectrumPlot({ points, maxHz, tickStepHz, formatTick, baselineHz, markerHz, label }: PlotProps) {
  const ref = useCanvas((ctx, width, height, color) => {
    const plotHeight = height - AXIS_HEIGHT;
    const xAt = (hz: number) => (hz / maxHz) * width;
    const yAt = (value: number) => plotHeight - value * (plotHeight - TOP_GAP);

    ctx.font = "14px ui-monospace, monospace";
    ctx.fillStyle = color("--ink-muted");
    ctx.strokeStyle = color("--line");
    for (let hz = 0; hz <= maxHz; hz += tickStepHz) {
      ctx.beginPath();
      ctx.moveTo(xAt(hz), 0);
      ctx.lineTo(xAt(hz), plotHeight);
      ctx.stroke();
      ctx.fillText(formatTick(hz), xAt(hz) + 3, height - 5);
    }

    if (baselineHz !== null) {
      ctx.strokeStyle = color("--ink-muted");
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(xAt(baselineHz), 0);
      ctx.lineTo(xAt(baselineHz), plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (points.length < 2) return;

    const trace = (isNewPath: boolean) => {
      points.forEach((value, i) => {
        const x = (i / (points.length - 1)) * width;
        if (i === 0 && isNewPath) ctx.moveTo(x, yAt(value));
        else ctx.lineTo(x, yAt(value));
      });
    };
    ctx.fillStyle = color("--ink");
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(0, plotHeight);
    trace(false);
    ctx.lineTo(width, plotHeight);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color("--ink");
    ctx.lineWidth = 2;
    ctx.beginPath();
    trace(true);
    ctx.stroke();

    if (markerHz !== null) {
      ctx.fillStyle = color("--action");
      ctx.fillRect(xAt(markerHz) - 1, 0, 2, plotHeight);
    }
  });
  return <canvas ref={ref} className="h-56 w-full" aria-label={label} />;
}

type SpectrumProps = {
  spectrum: Spectrum | null;
  baselineHz: number | null;
  markerHz: number | null;
};

const DEFAULT_CAMERA_MAX_HZ = 15;
const CAMERA_TICK_HZ = 5;

export function SpectrumChart({ spectrum, baselineHz, markerHz }: SpectrumProps) {
  const peak = spectrum ? spectrum.mags.reduce((max, value) => Math.max(max, value), 0) || 1 : 1;
  return (
    <SpectrumPlot
      points={spectrum ? Array.from(spectrum.mags, (value) => value / peak) : []}
      maxHz={spectrum ? spectrum.sampleRate / 2 : DEFAULT_CAMERA_MAX_HZ}
      tickStepHz={CAMERA_TICK_HZ}
      formatTick={(hz) => `${hz}`}
      baselineHz={baselineHz}
      markerHz={markerHz}
      label="Vibration strength by frequency, in cycles per second"
    />
  );
}

type SoundProps = {
  plot: number[];
  maxHz: number;
  markerHz: number | null;
};

const SOUND_TICK_HZ = 4000;

export function SoundSpectrumChart({ plot, maxHz, markerHz }: SoundProps) {
  return (
    <SpectrumPlot
      points={plot}
      maxHz={maxHz}
      tickStepHz={SOUND_TICK_HZ}
      formatTick={(hz) => `${hz / 1000}k`}
      baselineHz={null}
      markerHz={markerHz}
      label="Sound level by frequency, in thousands of cycles per second"
    />
  );
}

const MAP_WIDTH_PX = 600;
const MAP_HEIGHT_PX = 256;
const MAP_STEP_PX = 2;
const MAP_MIN_HZ = 50;
const MAP_TICKS_HZ = [100, 1000, 10000];

// Scrolling map of the whole sound spectrum: time runs left to right, pitch runs bottom to top,
// darker means louder. A tone draws one line, a hum draws a stack of lines.
// Pitch is on a log scale so engine hums (hundreds of Hz) get as much room as near-ultrasound.
export function SoundMap({ plot, maxHz }: { plot: number[]; maxHz: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || plot.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const styles = getComputedStyle(canvas);
    const x = MAP_WIDTH_PX - MAP_STEP_PX;

    ctx.globalAlpha = 1;
    ctx.drawImage(canvas, -MAP_STEP_PX, 0);
    ctx.fillStyle = styles.getPropertyValue("--page").trim();
    ctx.fillRect(x, 0, MAP_STEP_PX, MAP_HEIGHT_PX);
    ctx.fillStyle = styles.getPropertyValue("--ink").trim();
    const indexAt = (row: number) =>
      Math.floor(((MAP_MIN_HZ * (maxHz / MAP_MIN_HZ) ** (row / MAP_HEIGHT_PX)) / maxHz) * plot.length);
    for (let row = 0; row < MAP_HEIGHT_PX; row++) {
      const from = Math.min(plot.length - 1, indexAt(row));
      const to = Math.min(plot.length, Math.max(from + 1, indexAt(row + 1)));
      let level = 0;
      for (let i = from; i < to; i++) level = Math.max(level, plot[i]);
      ctx.globalAlpha = level * level;
      ctx.fillRect(x, MAP_HEIGHT_PX - 1 - row, MAP_STEP_PX, 1);
    }
  }, [plot, maxHz]);

  return (
    <div className="relative">
      <canvas
        ref={ref}
        width={MAP_WIDTH_PX}
        height={MAP_HEIGHT_PX}
        className="h-64 w-full bg-page"
        style={{ imageRendering: "pixelated" }}
        aria-label="Sound level across all pitches over the last 30 seconds"
      />
      {MAP_TICKS_HZ.map((hz) => (
        <span
          key={hz}
          className="absolute left-1 -translate-y-1/2 bg-page px-1 text-sm text-ink-muted"
          style={{ top: `${(1 - Math.log(hz / MAP_MIN_HZ) / Math.log(maxHz / MAP_MIN_HZ)) * 100}%` }}
        >
          {hz >= 1000 ? `${hz / 1000}k` : hz}
        </span>
      ))}
    </div>
  );
}
