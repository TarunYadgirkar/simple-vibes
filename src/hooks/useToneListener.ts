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
const PLOT_POINTS = 2048;
const DEFAULT_MAX_HZ = 24000;
const HUM_START_SCORE = 8;
const HUM_SCORE_CAP = 20;
const HUM_WRONG_PITCH_PENALTY = 1;
const HUM_ACTIVE_MISS_PENALTY = 0.34;
const TONE_MIN_POLLS = 3;
const HUM_PITCH_TOLERANCE = 0.08;

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
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: { ideal: 48000 },
        },
      });
    } catch {
      setError("Microphone access was blocked. Allow the microphone for this page, then press start again.");
      return;
    }
    const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
    if (id !== session.current) return stopTracks();

    const audio = new AudioContext();
    await audio.resume();
    const analyser = audio.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    audio.createMediaStreamSource(stream).connect(analyser);
    const bins = new Float32Array(analyser.frequencyBinCount);
    const binHz = audio.sampleRate / FFT_SIZE;
    let pending: Tone | null = null;
    let pendingSince = 0;
    let pendingPolls = 0;
    let humPitch = 0;
    let humScore = 0;
    let activeHum: Hum | null = null;

    const timer = setInterval(() => {
      analyser.getFloatFrequencyData(bins);
      const estimate = findTone(bins, binHz, settings.current.minHz);
      const now = Date.now();
      const tone = estimate ? { ...estimate, at: now } : null;
      if (tone) {
        if (!pending) {
          pendingSince = now;
          pendingPolls = 0;
        }
        pendingPolls += 1;
        if (!pending || tone.snrDb > pending.snrDb) pending = tone;
      }
      if (pending && (!tone || now - pendingSince > COMMIT_AFTER_MS)) {
        // A blip shorter than half a second is a click or a syllable, not a tone.
        if (pendingPolls >= TONE_MIN_POLLS) settings.current.onTone(pending);
        pending = null;
      }
      // Speech also has overtones, but its pitch wanders. A hum earns a point for each look that holds
      // its pitch and loses one for each look that misses, so beating rotors survive and syllables do not.
      const hum = findHum(bins, binHz);
      const holdsPitch =
        hum !== null && (humScore === 0 || Math.abs(hum.hz - humPitch) / humPitch <= HUM_PITCH_TOLERANCE);
      if (hum && holdsPitch) {
        humPitch = humScore === 0 ? hum.hz : humPitch * 0.8 + hum.hz * 0.2;
        humScore = Math.min(HUM_SCORE_CAP, humScore + 1);
      } else {
        const penalty = activeHum ? HUM_ACTIVE_MISS_PENALTY : hum ? HUM_WRONG_PITCH_PENALTY : 1;
        humScore = Math.max(0, humScore - penalty);
      }
      if (!activeHum && hum && humScore >= HUM_START_SCORE) {
        activeHum = { id: now, hz: humPitch, harmonics: hum.harmonics };
        settings.current.onHumStart(activeHum);
      } else if (activeHum && humScore === 0) {
        settings.current.onHumEnd(activeHum.id, (now - activeHum.id) / 1000);
        activeHum = null;
      } else if (activeHum && hum && holdsPitch) {
        activeHum = { ...activeHum, hz: humPitch, harmonics: hum.harmonics };
      }

      setFrame({ tone, hum: activeHum, plot: toPlotPoints(bins, PLOT_POINTS), maxHz: audio.sampleRate / 2 });
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
