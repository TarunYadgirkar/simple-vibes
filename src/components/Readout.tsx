import { Crosshair } from "@phosphor-icons/react/dist/ssr";
import { classify, deviationPct, type Reading } from "../lib/monitor/log";
import { Button, formatDeviation, formatHz, HealthPill, Panel } from "./ui";

type Props = {
  live: Reading | null;
  last: Reading | null;
  baseline: Reading | null;
  onSetBaseline: () => void;
};

export function Readout({ live, last, baseline, onSetBaseline }: Props) {
  const shown = live ?? last;
  const deviation = shown ? deviationPct(shown.hz, baseline) : null;
  const caption = live
    ? "Reading now"
    : last
      ? "Last reading. Waiting for the next vibration."
      : "Waiting for a vibration. Pluck or tap the part inside the box.";

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-muted">{caption}</p>
        <HealthPill health={classify(deviation)} />
      </div>
      <p className={`flex items-baseline gap-3 font-display leading-none ${live ? "text-ink" : "text-ink-muted"}`}>
        <span className="text-[7.5rem] tabular-nums">{shown ? formatHz(shown.hz) : "0.00"}</span>
        <span className="text-4xl">Hz</span>
      </p>
      <dl className="grid grid-cols-3 gap-3 font-mono text-sm tabular-nums">
        <div>
          <dt className="font-sans text-xs text-ink-muted">Change from baseline</dt>
          <dd>{formatDeviation(deviation)}</dd>
        </div>
        <div>
          <dt className="font-sans text-xs text-ink-muted">Healthy baseline</dt>
          <dd>{baseline ? `${formatHz(baseline.hz)} Hz` : "not set"}</dd>
        </div>
        <div>
          <dt className="font-sans text-xs text-ink-muted">Movement</dt>
          <dd>{shown ? `${shown.amplitudePx.toFixed(1)} px` : "n/a"}</dd>
        </div>
      </dl>
      <Button onClick={onSetBaseline} disabled={!last} className="self-start">
        <Crosshair size={16} weight="bold" />
        Save last reading as healthy baseline
      </Button>
    </Panel>
  );
}
