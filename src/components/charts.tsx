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
    ctx.strokeStyle = color("--accent");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    wave.forEach((value, i) => {
      const x = (i / (wave.length - 1)) * width;
      const y = height / 2 + (value / span) * (height / 2 - 6);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  return <canvas ref={ref} className="h-24 w-full" aria-label="Displacement of the watched part over the last few seconds" />;
}

type SpectrumProps = {
  spectrum: Spectrum | null;
  baselineHz: number | null;
  markerHz: number | null;
};

const AXIS_HEIGHT = 18;
const TICK_STEP_HZ = 5;

export function SpectrumChart({ spectrum, baselineHz, markerHz }: SpectrumProps) {
  const ref = useCanvas((ctx, width, height, color) => {
    const plotHeight = height - AXIS_HEIGHT;
    const maxHz = spectrum ? spectrum.sampleRate / 2 : 15;
    const xAt = (hz: number) => (hz / maxHz) * width;

    ctx.font = "11px var(--font-plex-mono), monospace";
    ctx.fillStyle = color("--ink-muted");
    ctx.strokeStyle = color("--line");
    for (let hz = 0; hz <= maxHz; hz += TICK_STEP_HZ) {
      ctx.beginPath();
      ctx.moveTo(xAt(hz), 0);
      ctx.lineTo(xAt(hz), plotHeight);
      ctx.stroke();
      ctx.fillText(`${hz}`, xAt(hz) + 3, height - 4);
    }

    if (baselineHz !== null) {
      ctx.strokeStyle = color("--trace-ref");
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xAt(baselineHz), 0);
      ctx.lineTo(xAt(baselineHz), plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!spectrum) return;

    const peak = spectrum.mags.reduce((max, value) => Math.max(max, value), 0) || 1;
    ctx.fillStyle = color("--accent");
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(0, plotHeight);
    spectrum.mags.forEach((value, i) => {
      ctx.lineTo(xAt(i * spectrum.binHz), plotHeight - (value / peak) * (plotHeight - 4));
    });
    ctx.lineTo(width, plotHeight);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color("--accent");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    spectrum.mags.forEach((value, i) => {
      const x = xAt(i * spectrum.binHz);
      const y = plotHeight - (value / peak) * (plotHeight - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (markerHz !== null) {
      ctx.fillStyle = color("--ink");
      ctx.fillRect(xAt(markerHz) - 1, 0, 2, plotHeight);
    }
  });
  return <canvas ref={ref} className="h-40 w-full" aria-label="Vibration strength by frequency, in cycles per second" />;
}
