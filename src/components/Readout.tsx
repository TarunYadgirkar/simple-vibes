import { classify, deviationPct, type Reading } from "../lib/monitor/log";
import { Button, formatDeviation, formatHz, HealthPill } from "./ui";

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
    ? "reading now"
    : last
      ? "last reading, waiting for the next vibration"
      : "waiting: pluck or tap the part inside the box";

  return (
    <section className="flex flex-col gap-3">
      <p className="flex items-baseline justify-between gap-3 text-ink-muted">
        <span>{caption}</span>
        <HealthPill health={classify(deviation)} />
      </p>
      <p className={`flex items-baseline gap-3 leading-none ${live ? "text-ink" : "text-ink-muted"}`}>
        <span className="text-[8rem] font-medium tracking-tighter tabular-nums">
          {shown ? formatHz(shown.hz) : "0.00"}
        </span>
        <span className="text-4xl">Hz</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 text-lg tabular-nums">
        <dt className="text-ink-muted">change from baseline</dt>
        <dd>{formatDeviation(deviation)}</dd>
        <dt className="text-ink-muted">healthy baseline</dt>
        <dd>{baseline ? `${formatHz(baseline.hz)} Hz` : "not set"}</dd>
        <dt className="text-ink-muted">movement</dt>
        <dd>{shown ? `${shown.amplitudePx.toFixed(1)} px` : "n/a"}</dd>
      </dl>
      <Button onClick={onSetBaseline} disabled={!last} className="self-start">
        save last reading as healthy baseline
      </Button>
    </section>
  );
}
