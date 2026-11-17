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

    const trace = () => {
      points.forEach((value, i) => {
        const x = (i / (points.length - 1)) * width;
        if (i === 0) ctx.moveTo(x, yAt(value));
        else ctx.lineTo(x, yAt(value));
      });
    };
    ctx.fillStyle = color("--ink");
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(0, plotHeight);
    trace();
    ctx.lineTo(width, plotHeight);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color("--ink");
    ctx.lineWidth = 2;
    ctx.beginPath();
    trace();
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
