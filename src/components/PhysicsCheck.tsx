"use client";

import { useState } from "react";
import type { Reading } from "../lib/monitor/log";
import { FIELD_CLASS, formatHz, Panel } from "./ui";

type Props = {
  baseline: Reading | null;
  last: Reading | null;
};

const MODELS = {
  string: { label: "cable (f ∝ 1/L)", exponent: 1 },
  strip: { label: "clamped strip (f ∝ 1/L²)", exponent: 2 },
} as const;

type ModelId = keyof typeof MODELS;

const INPUT_CLASS = `${FIELD_CLASS} w-full`;

export function PhysicsCheck({ baseline, last }: Props) {
  const [model, setModel] = useState<ModelId>("string");
  const [baseLength, setBaseLength] = useState("60");
  const [newLength, setNewLength] = useState("60");

  const from = Number(baseLength);
  const to = Number(newLength);
  const isValid = baseline !== null && from > 0 && to > 0;
  const predicted = isValid ? baseline.hz * (from / to) ** MODELS[model].exponent : null;
  const error = predicted && last ? ((last.hz - predicted) / predicted) * 100 : null;

  return (
    <Panel title="theory check">
      <div className="grid grid-cols-3 items-end gap-3">
        <label className="flex flex-col text-ink-muted">
          object
          <select value={model} onChange={(event) => setModel(event.target.value as ModelId)} className={INPUT_CLASS}>
            {Object.entries(MODELS).map(([id, { label }]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-ink-muted">
          length at baseline (cm)
          <input inputMode="decimal" value={baseLength} onChange={(event) => setBaseLength(event.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col text-ink-muted">
          length now (cm)
          <input inputMode="decimal" value={newLength} onChange={(event) => setNewLength(event.target.value)} className={INPUT_CLASS} />
        </label>
      </div>
      <p className="tabular-nums">
        {predicted === null
          ? "set a baseline first"
          : `predicted ${formatHz(predicted)} Hz, measured ${last ? formatHz(last.hz) : "n/a"} Hz${
              error === null ? "" : `, off ${Math.abs(error).toFixed(1)}%`
            }`}
      </p>
    </Panel>
  );
}
