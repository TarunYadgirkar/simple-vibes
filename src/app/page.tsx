"use client";

import { useCallback, useReducer, useState } from "react";
import { Play, Stop } from "@phosphor-icons/react";
import { CameraView } from "../components/CameraView";
import { SpectrumChart, WaveChart } from "../components/charts";
import { EventLog } from "../components/EventLog";
import { PhysicsCheck } from "../components/PhysicsCheck";
import { Readout } from "../components/Readout";
import { ReportPanel } from "../components/ReportPanel";
import { Button, Panel } from "../components/ui";
import { TEST_SOURCE, useVibrationMonitor, type Roi } from "../hooks/useVibrationMonitor";
import type { Axis } from "../lib/dsp/motion";
import { initialLog, logReducer, type Reading } from "../lib/monitor/log";
import { TEST_PATTERN_HZ } from "../lib/sources/testPattern";

const DEFAULT_ROI: Roi = { x: 0.35, y: 0.2, w: 0.3, h: 0.6 };
const DEFAULT_CAMERA = "";
const SELECT_CLASS = "h-9 rounded-control bg-panel px-2 text-sm text-ink shadow-panel";

export default function Home() {
  const [roi, setRoi] = useState(DEFAULT_ROI);
  const [axis, setAxis] = useState<Axis>("vertical");
  const [source, setSource] = useState(DEFAULT_CAMERA);
  const [log, dispatch] = useReducer(logReducer, initialLog);

  const handleReading = useCallback(
    (reading: Reading) => dispatch({ type: "reading", reading }),
    [],
  );
  const monitor = useVibrationMonitor({ roi, axis, onReading: handleReading });
  const isRunning = monitor.runState === "running";
  const { frame } = monitor;

  const handleSourceChange = (next: string) => {
    setSource(next);
    if (monitor.runState !== "idle") void monitor.start(next);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none">Simple Vibes</h1>
          <p className="text-sm text-ink-muted">
            Reads how fast something vibrates from an ordinary camera, and flags when that changes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Source
            <select value={source} onChange={(event) => handleSourceChange(event.target.value)} className={SELECT_CLASS}>
              <option value={DEFAULT_CAMERA}>Default camera</option>
              {monitor.cameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || "Camera"}
                </option>
              ))}
              <option value={TEST_SOURCE}>Test string ({TEST_PATTERN_HZ} Hz)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Motion
            <select value={axis} onChange={(event) => setAxis(event.target.value as Axis)} className={SELECT_CLASS}>
              <option value="vertical">Up and down</option>
              <option value="horizontal">Side to side</option>
            </select>
          </label>
          {isRunning ? (
            <Button onClick={monitor.stop}>
              <Stop size={16} weight="fill" />
              Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void monitor.start(source)} disabled={monitor.runState === "starting"}>
              <Play size={16} weight="fill" />
              Start
            </Button>
          )}
        </div>
      </header>

      {monitor.error && (
        <p role="alert" className="rounded-control bg-crit/12 px-3 py-2 text-sm text-crit">
          {monitor.error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Panel>
            <CameraView videoRef={monitor.videoRef} roi={roi} onRoiChange={setRoi} isRunning={isRunning} />
            <WaveChart wave={frame.wave} />
          </Panel>
          <PhysicsCheck baseline={log.baseline} last={log.last} />
        </div>
        <div className="flex flex-col gap-4">
          <Readout
            live={frame.live}
            last={log.last}
            baseline={log.baseline}
            onSetBaseline={() => dispatch({ type: "setBaseline" })}
          />
          <Panel title="Frequency spectrum (Hz)">
            <SpectrumChart
              spectrum={frame.spectrum}
              baselineHz={log.baseline?.hz ?? null}
              markerHz={frame.live?.hz ?? null}
            />
            <p className="text-xs text-ink-muted">
              {frame.spectrum
                ? `Camera is delivering ${frame.spectrum.sampleRate.toFixed(0)} frames per second, so it can read up to ${(frame.spectrum.sampleRate / 2).toFixed(0)} Hz.`
                : "The dashed line marks the healthy baseline once you save one."}
            </p>
          </Panel>
        </div>
      </div>

      <Panel
        title="Watch log"
        action={
          <Button onClick={() => dispatch({ type: "clear" })} disabled={log.events.length === 0}>
            Clear log and baseline
          </Button>
        }
      >
        <EventLog events={log.events} />
      </Panel>

      <ReportPanel events={log.events} baselineHz={log.baseline?.hz ?? null} />
    </main>
  );
}
