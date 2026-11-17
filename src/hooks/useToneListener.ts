"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findHum, findTone, toPlotPoints } from "../lib/dsp/tone";

export interface Tone {
  hz: number;
  levelDb: number;
  snrDb: number;
  at: number;
}

export interface Hum {
  id: number;
  hz: number;
  harmonics: number;
}

export interface ToneFrame {
  tone: Tone | null;
  hum: Hum | null;
  plot: number[];
  maxHz: number;
}

const FFT_SIZE = 16384;
const SMOOTHING = 0.5;
const POLL_MS = 100;
const COMMIT_AFTER_MS = 5000;
const PLOT_POINTS = 512;
const DEFAULT_MAX_HZ = 24000;
const HUM_STABLE_POLLS = 15;
const HUM_MAX_MISSES = 3;
const HUM_PITCH_TOLERANCE = 0.05;

const EMPTY_FRAME: ToneFrame = { tone: null, hum: null, plot: [], maxHz: DEFAULT_MAX_HZ };

interface Options {
  minHz: number;
  onTone: (tone: Tone) => void;
  onHumStart: (hum: Hum) => void;
  onHumEnd: (id: number, seconds: number) => void;
}

export function useToneListener({ minHz, onTone, onHumStart, onHumEnd }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<ToneFrame>(EMPTY_FRAME);
  const release = useRef<() => void>(() => {});
  const session = useRef(0);
  const settings = useRef({ minHz, onTone, onHumStart, onHumEnd });

  useEffect(() => {
    settings.current = { minHz, onTone, onHumStart, onHumEnd };
  }, [minHz, onTone, onHumStart, onHumEnd]);

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
      if (id !== session.current) return;
      setError("Microphone access was blocked. Allow the microphone for this page, then press start again.");
      return;
    }
    let tracksStopped = false;
    const stopTracks = () => {
      if (tracksStopped) return;
      tracksStopped = true;
      stream.getTracks().forEach((track) => track.stop());
    };
    if (id !== session.current) return stopTracks();

    let audio: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let activeHum: Hum | null = null;
    const cleanup = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      stopTracks();
      if (audio) {
        void audio.close();
        audio = null;
      }
      if (activeHum) {
        settings.current.onHumEnd(activeHum.id, (Date.now() - activeHum.id) / 1000);
        activeHum = null;
      }
    };
    release.current = cleanup;

    try {
      const context = new AudioContext();
      audio = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING;
      context.createMediaStreamSource(stream).connect(analyser);
      if (context.state === "suspended") await context.resume();
      if (id !== session.current) return cleanup();
      const bins = new Float32Array(analyser.frequencyBinCount);
      const binHz = context.sampleRate / FFT_SIZE;
      let pending: Tone | null = null;
      let pendingSince = 0;
      let pendingMinHz = settings.current.minHz;
      let humPitch = 0;
      let humRun = 0;
      let humMisses = 0;

      timer = setInterval(() => {
        if (pendingMinHz !== settings.current.minHz) {
          pending = null;
          pendingMinHz = settings.current.minHz;
        }
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
        // Speech also has overtones, but its pitch wanders. Only a pitch that holds steady counts as a hum.
        const hum = findHum(bins, binHz);
        const holdsPitch = hum !== null && (humRun === 0 || Math.abs(hum.hz - humPitch) / humPitch <= HUM_PITCH_TOLERANCE);
        if (hum && holdsPitch) {
          humPitch = humRun === 0 ? hum.hz : humPitch * 0.8 + hum.hz * 0.2;
          humRun += 1;
          humMisses = 0;
        } else {
          humMisses += 1;
          if (humMisses > HUM_MAX_MISSES) humRun = 0;
        }
        if (!activeHum && hum && humRun >= HUM_STABLE_POLLS) {
          activeHum = { id: now, hz: humPitch, harmonics: hum.harmonics };
          settings.current.onHumStart(activeHum);
        } else if (activeHum && humRun === 0) {
          settings.current.onHumEnd(activeHum.id, (now - activeHum.id) / 1000);
          activeHum = null;
        } else if (activeHum && hum && holdsPitch) {
          activeHum = { ...activeHum, hz: humPitch, harmonics: hum.harmonics };
        }

        setFrame({ tone, hum: activeHum, plot: toPlotPoints(bins, PLOT_POINTS), maxHz: context.sampleRate / 2 });
      }, POLL_MS);
      setIsListening(true);
    } catch {
      cleanup();
      if (id !== session.current) return;
      release.current = () => {};
      setError("Microphone could not start. Check microphone permission, then press start again.");
    }
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
