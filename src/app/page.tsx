"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { CameraView } from "../components/CameraView";
import { SpectrumChart, WaveChart } from "../components/charts";
import { EventLog } from "../components/EventLog";
import { PhysicsCheck } from "../components/PhysicsCheck";
import { Readout } from "../components/Readout";
import { ReportPanel } from "../components/ReportPanel";
import { SOUND_BANDS, SoundPanel } from "../components/SoundPanel";
import { Button, FIELD_CLASS, Panel } from "../components/ui";
import { useToneListener, type Tone } from "../hooks/useToneListener";
import { TEST_SOURCE, useVibrationMonitor, type Roi } from "../hooks/useVibrationMonitor";
import type { Axis } from "../lib/dsp/motion";
import { fetchDiagnosis, LOOKING_NOTE } from "../lib/monitor/diagnose";
import { classify, deviationPct, initialLog, logReducer, type Reading } from "../lib/monitor/log";
import { TEST_PATTERN_HZ } from "../lib/sources/testPattern";
import { sendTelemetry } from "../lib/telemetry";

const DEFAULT_ROI: Roi = { x: 0.35, y: 0.2, w: 0.3, h: 0.6 };
const DEFAULT_CAMERA = "";
const STATUS_EVERY_MS = 2000;
const FRAME_EVERY_MS = 8000;

export default function Home() {
  const [roi, setRoi] = useState(DEFAULT_ROI);
  const [axis, setAxis] = useState<Axis>("vertical");
  const [source, setSource] = useState(DEFAULT_CAMERA);
  const [log, dispatch] = useReducer(logReducer, initialLog);

  const [assetName, setAssetName] = useState("Test cable");
  const context = useRef({ log, assetName, capture: (): string | null => null });

  const handleReading = useCallback((reading: Reading) => {
    const { log: current, assetName: name, capture } = context.current;
    const deviation = deviationPct(reading.hz, current.baseline);
    const health = classify(deviation);
    const hasChanged = health === "drift" || health === "fault";
    const frameNow = hasChanged && current.baselineImage ? capture() : null;
    dispatch({ type: "reading", reading, note: frameNow ? LOOKING_NOTE : null });
    sendTelemetry("event", { what: "camera reading", ...reading, deviation, health });
    if (!frameNow || !current.baseline || !current.baselineImage || deviation === null) return;

    void fetchDiagnosis({
      assetName: name.trim() || "Watched part",
      baselineHz: current.baseline.hz,
      hz: reading.hz,
      deviationPct: deviation,
      baselineImage: current.baselineImage,
      currentImage: frameNow,
    }).then((note) => {
      dispatch({ type: "note", id: reading.at, note });
      sendTelemetry("event", { what: "agent note", at: reading.at, note });
    });
  }, []);

  const [minHz, setMinHz] = useState<number>(SOUND_BANDS[2].minHz);
  const [lastTone, setLastTone] = useState<Tone | null>(null);
  const handleTone = useCallback((tone: Tone) => {
    setLastTone(tone);
    dispatch({ type: "tone", ...tone });
    sendTelemetry("event", { what: "mic tone", ...tone });
  }, []);
  const sound = useToneListener({ minHz, onTone: handleTone });
  const monitor = useVibrationMonitor({ roi, axis, onReading: handleReading });
  const { captureFrame } = monitor;

  useEffect(() => {
    context.current = { log, assetName, capture: captureFrame };
  }, [log, assetName, captureFrame]);
  const isRunning = monitor.runState === "running";
  const { frame } = monitor;

  const status = useRef<Record<string, unknown>>({});
  useEffect(() => {
    status.current = {
      camera: {
        runState: monitor.runState,
        error: monitor.error,
        source,
        axis,
        roi,
        framesPerSecond: frame.spectrum?.sampleRate ?? null,
        peakHz: frame.spectrum?.peakHz ?? null,
        snr: frame.spectrum?.snr ?? null,
        movementPx: frame.spectrum?.amplitude ?? null,
        isLocked: frame.live !== null,
      },
      mic: { isListening: sound.isListening, error: sound.error, minHz, tone: sound.frame.tone },
      baselineHz: log.baseline?.hz ?? null,
      eventCount: log.events.length,
    };
  });

  useEffect(() => {
    const timer = setInterval(() => sendTelemetry("status", status.current), STATUS_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      const image = captureFrame();
      if (image) sendTelemetry("frame", { image });
    }, FRAME_EVERY_MS);
    return () => clearInterval(timer);
  }, [isRunning, captureFrame]);

  const handleSourceChange = (next: string) => {
    setSource(next);
    if (monitor.runState !== "idle") void monitor.start(next);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-medium">simple vibes</h1>
          <p className="text-ink-muted">vibration frequency from a webcam and a mic</p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <label className="flex items-baseline gap-2 text-ink-muted">
            source
            <select value={source} onChange={(event) => handleSourceChange(event.target.value)} className={FIELD_CLASS}>
              <option value={DEFAULT_CAMERA}>default camera</option>
              {monitor.cameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || "camera"}
                </option>
              ))}
              <option value={TEST_SOURCE}>test string, {TEST_PATTERN_HZ} Hz</option>
            </select>
          </label>
          <label className="flex items-baseline gap-2 text-ink-muted">
            motion
            <select value={axis} onChange={(event) => setAxis(event.target.value as Axis)} className={FIELD_CLASS}>
              <option value="vertical">up and down</option>
              <option value="horizontal">side to side</option>
            </select>
          </label>
          {isRunning ? (
            <Button onClick={monitor.stop}>stop</Button>
          ) : (
            <Button variant="primary" onClick={() => void monitor.start(source)} disabled={monitor.runState === "starting"}>
              start
            </Button>
          )}
        </div>
      </header>

      {monitor.error && (
        <p role="alert" className="text-crit">
          {monitor.error}
        </p>
      )}

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <CameraView videoRef={monitor.videoRef} roi={roi} onRoiChange={setRoi} isRunning={isRunning} />
            <WaveChart wave={frame.wave} />
          </div>
          <PhysicsCheck baseline={log.baseline} last={log.last} />
        </div>
        <div className="flex flex-col gap-6">
          <Readout
            live={frame.live}
            last={log.last}
            baseline={log.baseline}
            onSetBaseline={() => {
              dispatch({ type: "setBaseline", image: captureFrame() });
              sendTelemetry("event", { what: "baseline saved", hz: log.last?.hz ?? null });
            }}
          />
          <Panel title="spectrum (Hz)">
            <SpectrumChart
              spectrum={frame.spectrum}
              baselineHz={log.baseline?.hz ?? null}
              markerHz={frame.live?.hz ?? null}
            />
            <p className="text-ink-muted">
              {frame.spectrum
                ? `camera at ${frame.spectrum.sampleRate.toFixed(0)} fps, reads up to ${(frame.spectrum.sampleRate / 2).toFixed(0)} Hz`
                : "dashed line = baseline"}
            </p>
          </Panel>
        </div>
      </div>

      <SoundPanel
        isListening={sound.isListening}
        frame={sound.frame}
        lastTone={lastTone}
        error={sound.error}
        minHz={minHz}
        onMinHzChange={setMinHz}
        onStart={() => void sound.start()}
        onStop={sound.stop}
      />

      <Panel
        title="watch log"
        action={
          <Button onClick={() => dispatch({ type: "clear" })} disabled={log.events.length === 0}>
            clear
          </Button>
        }
      >
        <EventLog events={log.events} />
      </Panel>

      <ReportPanel
        events={log.events}
        baselineHz={log.baseline?.hz ?? null}
        assetName={assetName}
        onAssetNameChange={setAssetName}
      />
    </main>
  );
}
