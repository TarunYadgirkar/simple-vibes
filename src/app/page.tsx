"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { CameraView } from "../components/CameraView";
import { SpectrumChart, WaveChart } from "../components/charts";
import { EventLog } from "../components/EventLog";
import { PhysicsCheck } from "../components/PhysicsCheck";
import { Readout } from "../components/Readout";
import { ReportPanel } from "../components/ReportPanel";
import { Button, FIELD_CLASS, Panel } from "../components/ui";
import { TEST_SOURCE, useVibrationMonitor, type Roi } from "../hooks/useVibrationMonitor";
import type { Axis } from "../lib/dsp/motion";
import { fetchDiagnosis, LOOKING_NOTE } from "../lib/monitor/diagnose";
import { classify, deviationPct, initialLog, logReducer, type Reading } from "../lib/monitor/log";
import { TEST_PATTERN_HZ } from "../lib/sources/testPattern";

const DEFAULT_ROI: Roi = { x: 0.35, y: 0.2, w: 0.3, h: 0.6 };
const DEFAULT_CAMERA = "";

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
    if (!frameNow || !current.baseline || !current.baselineImage || deviation === null) return;

    void fetchDiagnosis({
      assetName: name.trim() || "Watched part",
      baselineHz: current.baseline.hz,
      hz: reading.hz,
      deviationPct: deviation,
      baselineImage: current.baselineImage,
      currentImage: frameNow,
    }).then((note) => dispatch({ type: "note", id: reading.at, note }));
  }, []);
  const monitor = useVibrationMonitor({ roi, axis, onReading: handleReading });
  const { captureFrame } = monitor;

  useEffect(() => {
    context.current = { log, assetName, capture: captureFrame };
  }, [log, assetName, captureFrame]);
  const isRunning = monitor.runState === "running";
  const { frame } = monitor;

  const handleSourceChange = (next: string) => {
    setSource(next);
    if (monitor.runState !== "idle") void monitor.start(next);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-medium">simple vibes</h1>
          <p className="text-ink-muted">
            Reads how fast something vibrates from an ordinary camera, and flags when that changes.
          </p>
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
            onSetBaseline={() => dispatch({ type: "setBaseline", image: captureFrame() })}
          />
          <Panel title="frequency spectrum (Hz)">
            <SpectrumChart
              spectrum={frame.spectrum}
              baselineHz={log.baseline?.hz ?? null}
              markerHz={frame.live?.hz ?? null}
            />
            <p className="text-ink-muted">
              {frame.spectrum
                ? `Camera is delivering ${frame.spectrum.sampleRate.toFixed(0)} frames per second, so it can read up to ${(frame.spectrum.sampleRate / 2).toFixed(0)} Hz.`
                : "The dashed line marks the healthy baseline once you save one."}
            </p>
          </Panel>
        </div>
      </div>

      <Panel
        title="watch log"
        action={
          <Button onClick={() => dispatch({ type: "clear" })} disabled={log.events.length === 0}>
            clear log and baseline
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
