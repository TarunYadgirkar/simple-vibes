"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findTone, toPlotPoints } from "../lib/dsp/tone";

export interface Tone {
  hz: number;
  levelDb: number;
  snrDb: number;
  at: number;
}

export interface ToneFrame {
  tone: Tone | null;
  plot: number[];
  maxHz: number;
}

const FFT_SIZE = 16384;
const SMOOTHING = 0.5;
const POLL_MS = 100;
const COMMIT_AFTER_MS = 5000;
const PLOT_POINTS = 512;
const DEFAULT_MAX_HZ = 24000;

const EMPTY_FRAME: ToneFrame = { tone: null, plot: [], maxHz: DEFAULT_MAX_HZ };

interface Options {
  minHz: number;
  onTone: (tone: Tone) => void;
}

export function useToneListener({ minHz, onTone }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<ToneFrame>(EMPTY_FRAME);
  const release = useRef<() => void>(() => {});
  const session = useRef(0);
  const settings = useRef({ minHz, onTone });

  useEffect(() => {
    settings.current = { minHz, onTone };
  }, [minHz, onTone]);

  const stop = useCallback(() => {
    session.current += 1;
    release.current();
    release.current = () => {};
    setIsListening(false);
    setFrame(EMPTY_FRAME);
  }, []);

  const start = useCallback(async () => {
    stop();
    const id = session.current;
    setError(null);

    let stream: MediaStream;
    try {
      // Voice processing filters out steady tones, which is exactly what this listens for.
      stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      setError("Microphone access was blocked. Allow the microphone for this page, then press listen again.");
      return;
    }
    const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
    if (id !== session.current) return stopTracks();

    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    audio.createMediaStreamSource(stream).connect(analyser);
    const bins = new Float32Array(analyser.frequencyBinCount);
    const binHz = audio.sampleRate / FFT_SIZE;
    let pending: Tone | null = null;
    let pendingSince = 0;

    const timer = setInterval(() => {
      analyser.getFloatFrequencyData(bins);
      const estimate = findTone(bins, binHz, settings.current.minHz);
      const now = Date.now();
      const tone = estimate ? { ...estimate, at: now } : null;
      if (tone && (!pending || tone.snrDb > pending.snrDb)) {
        if (!pending) pendingSince = now;
        pending = tone;
      }
      if (pending && (!tone || now - pendingSince > COMMIT_AFTER_MS)) {
        settings.current.onTone(pending);
        pending = null;
      }
      setFrame({ tone, plot: toPlotPoints(bins, PLOT_POINTS), maxHz: audio.sampleRate / 2 });
    }, POLL_MS);

    release.current = () => {
      clearInterval(timer);
      stopTracks();
      void audio.close();
    };
    setIsListening(true);
  }, [stop]);

  useEffect(
    () => () => {
      session.current += 1;
      release.current();
    },
    [],
  );

  return { isListening, error, frame, start, stop };
}
