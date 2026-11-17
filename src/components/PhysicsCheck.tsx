"use client";

import { useState } from "react";
import type { Reading } from "../lib/monitor/log";
import { formatHz, Panel } from "./ui";

type Props = {
  baseline: Reading | null;
  last: Reading | null;
};

const MODELS = {
  string: { label: "Stretched cable (same tension)", exponent: 1 },
  strip: { label: "Strip clamped at one end", exponent: 2 },
} as const;

type ModelId = keyof typeof MODELS;

const INPUT_CLASS =
  "h-9 w-full rounded-control bg-surface px-2 font-mono text-sm tabular-nums text-ink";

export function PhysicsCheck({ baseline, last }: Props) {
  const [model, setModel] = useState<ModelId>("string");
  const [baseLength, setBaseLength] = useState("60");
  const [newLength, setNewLength] = useState("45");

  const from = Number(baseLength);
  const to = Number(newLength);
  const isValid = baseline !== null && from > 0 && to > 0;
  const predicted = isValid ? baseline.hz * (from / to) ** MODELS[model].exponent : null;
  const error = predicted && last ? ((last.hz - predicted) / predicted) * 100 : null;

  return (
    <Panel title="Check it against theory">
      <p className="text-sm text-ink-muted">
        Change the free length and the frequency should move by a known amount. Enter both lengths to
        compare the prediction with what the camera reads.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Object
          <select value={model} onChange={(event) => setModel(event.target.value as ModelId)} className={`${INPUT_CLASS} font-sans`}>
            {Object.entries(MODELS).map(([id, { label }]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Baseline length (cm)
          <input inputMode="decimal" value={baseLength} onChange={(event) => setBaseLength(event.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          New length (cm)
          <input inputMode="decimal" value={newLength} onChange={(event) => setNewLength(event.target.value)} className={INPUT_CLASS} />
        </label>
      </div>
      <p className="font-mono text-sm tabular-nums">
        {predicted === null
          ? "Save a baseline first."
          : `Predicted ${formatHz(predicted)} Hz, measured ${last ? formatHz(last.hz) : "n/a"} Hz${
              error === null ? "" : `, off by ${Math.abs(error).toFixed(1)}%`
            }`}
      </p>
    </Panel>
  );
}
