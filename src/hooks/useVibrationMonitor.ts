"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { edgeProfile, estimateShift, type Axis } from "../lib/dsp/motion";
import { analyze, type Sample, type Spectrum } from "../lib/dsp/spectrum";
import type { Reading } from "../lib/monitor/log";
import { createTestPattern } from "../lib/sources/testPattern";

export interface Roi {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MonitorFrame {
  wave: number[];
  spectrum: Spectrum | null;
  live: Reading | null;
}

export type RunState = "idle" | "starting" | "running" | "error";
export const TEST_SOURCE = "test";

const WINDOW_S = 2.5;
const ANALYZE_EVERY_FRAMES = 3;
const SNR_LOCK = 10;
const MIN_AMPLITUDE_PX = 0.05;
const COMMIT_AFTER_S = 5;
const REFERENCE_REFRESH_S = 3;
const MAX_PROFILE_PX = 320;
const MAX_LAG_FRACTION = 0.3;
const MIN_BOX_PX = 8;

interface Engine {
  samples: Sample[];
  reference: Float64Array | null;
  referenceAt: number;
  frames: number;
  lastT: number;
  pending: Reading | null;
  pendingSince: number;
}

const freshEngine = (): Engine => ({
  samples: [],
  reference: null,
  referenceAt: 0,
  frames: 0,
  lastT: -1,
  pending: null,
  pendingSince: 0,
});

const EMPTY_FRAME: MonitorFrame = { wave: [], spectrum: null, live: null };

interface Options {
  roi: Roi;
  axis: Axis;
  onReading: (reading: Reading) => void;
}

export function useVibrationMonitor({ roi, axis, onReading }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engine = useRef<Engine>(freshEngine());
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stopSource = useRef<() => void>(() => {});
  const settings = useRef({ roi, axis, onReading });
  const [frame, setFrame] = useState<MonitorFrame>(EMPTY_FRAME);
  const [runState, setRunState] = useState<RunState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    settings.current = { roi, axis, onReading };
  }, [roi, axis, onReading]);

  useEffect(() => {
    engine.current = freshEngine();
  }, [roi, axis]);

  const processFrame = useCallback((video: HTMLVideoElement, t: number) => {
    const state = engine.current;
    if (t <= state.lastT || video.videoWidth === 0) return;
    state.lastT = t;

    const { roi: box, axis: motionAxis, onReading: commit } = settings.current;
    const sw = Math.max(MIN_BOX_PX, Math.round(box.w * video.videoWidth));
    const sh = Math.max(MIN_BOX_PX, Math.round(box.h * video.videoHeight));
    const scale = Math.min(1, MAX_PROFILE_PX / Math.max(sw, sh));
    const cw = Math.max(MIN_BOX_PX, Math.round(sw * scale));
    const ch = Math.max(MIN_BOX_PX, Math.round(sh * scale));

    canvas.current ??= document.createElement("canvas");
    const work = canvas.current;
    if (work.width !== cw || work.height !== ch) {
      work.width = cw;
      work.height = ch;
      state.reference = null;
    }
    const ctx = work.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(
      video,
      Math.round(box.x * video.videoWidth),
      Math.round(box.y * video.videoHeight),
      sw,
      sh,
      0,
      0,
      cw,
      ch,
    );
    const profile = edgeProfile(ctx.getImageData(0, 0, cw, ch).data, cw, ch, motionAxis);

    if (!state.reference) {
      state.reference = profile;
      state.referenceAt = t;
      state.samples = [];
      return;
    }

    const maxLag = Math.floor(profile.length * MAX_LAG_FRACTION);
    const shift = estimateShift(state.reference, profile, maxLag) / scale;
    state.samples = [...state.samples.filter((s) => t - s.t <= WINDOW_S), { t, x: shift }];
    state.frames += 1;
    if (state.frames % ANALYZE_EVERY_FRAMES !== 0) return;

    const spectrum = analyze(state.samples);
    const isLocked =
      spectrum !== null && spectrum.snr >= SNR_LOCK && spectrum.amplitude >= MIN_AMPLITUDE_PX;
    const live: Reading | null = isLocked
      ? { hz: spectrum.peakHz, snr: spectrum.snr, amplitudePx: spectrum.amplitude, at: Date.now() }
      : null;

    if (live && (!state.pending || live.snr > state.pending.snr)) {
      if (!state.pending) state.pendingSince = t;
      state.pending = live;
    }
    if (state.pending && (!live || t - state.pendingSince > COMMIT_AFTER_S)) {
      commit(state.pending);
      state.pending = null;
    }
    if (!live && t - state.referenceAt > REFERENCE_REFRESH_S) {
      state.reference = profile;
      state.referenceAt = t;
      state.samples = [];
    }

    setFrame({ wave: spectrum?.detrended ?? [], spectrum, live });
  }, []);

  const stop = useCallback(() => {
    stopSource.current();
    stopSource.current = () => {};
    if (videoRef.current) videoRef.current.srcObject = null;
    engine.current = freshEngine();
    setFrame(EMPTY_FRAME);
    setRunState("idle");
  }, []);

  const start = useCallback(
    async (source: string) => {
      const video = videoRef.current;
      if (!video) return;
      stop();
      setRunState("starting");
      setError(null);

      try {
        if (source === TEST_SOURCE) {
          const pattern = createTestPattern();
          video.srcObject = pattern.stream;
          stopSource.current = pattern.stop;
        } else {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              deviceId: source ? { exact: source } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 60 },
            },
          });
          video.srcObject = stream;
          stopSource.current = () => stream.getTracks().forEach((track) => track.stop());
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCameras(devices.filter((device) => device.kind === "videoinput"));
        }
        await video.play();
      } catch {
        setError("Camera access was blocked. Allow the camera for this page, then press Start again.");
        setRunState("error");
        return;
      }

      let active = true;
      const previousStop = stopSource.current;
      stopSource.current = () => {
        active = false;
        previousStop();
      };
      const onFrame: VideoFrameRequestCallback = (_now, meta) => {
        if (!active) return;
        processFrame(video, meta.mediaTime);
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
      setRunState("running");
    },
    [processFrame, stop],
  );

  useEffect(() => () => stopSource.current(), []);

  return { videoRef, frame, runState, error, cameras, start, stop };
}
