import type { Tone, ToneFrame } from "../hooks/useToneListener";
import { SoundSpectrumChart } from "./charts";
import { Button, FIELD_CLASS, Panel } from "./ui";

type Props = {
  isListening: boolean;
  frame: ToneFrame;
  lastTone: Tone | null;
  error: string | null;
  minHz: number;
  onMinHzChange: (minHz: number) => void;
  onStart: () => void;
  onStop: () => void;
};

export const SOUND_BANDS = [
  { minHz: 80, label: "80 Hz and up" },
  { minHz: 2000, label: "above 2,000 Hz" },
  { minHz: 10000, label: "above 10,000 Hz" },
] as const;

const HARD_TO_HEAR_HZ = 15000;
const HZ_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function SoundPanel({ isListening, frame, lastTone, error, minHz, onMinHzChange, onStart, onStop }: Props) {
  const shown = frame.tone ?? lastTone;
  const caption = !isListening
    ? "mic off"
    : frame.tone
      ? "tone detected"
      : "listening";

  return (
    <Panel
      title="sound"
      action={
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <label className="flex items-baseline gap-2 text-ink-muted">
            band
            <select value={minHz} onChange={(event) => onMinHzChange(Number(event.target.value))} className={FIELD_CLASS}>
              {SOUND_BANDS.map((band) => (
                <option key={band.minHz} value={band.minHz}>
                  {band.label}
                </option>
              ))}
            </select>
          </label>
          {isListening ? (
            <Button onClick={onStop}>stop</Button>
          ) : (
            <Button variant="primary" onClick={onStart}>
              listen
            </Button>
          )}
        </div>
      }
    >
      {error && (
        <p role="alert" className="text-crit">
          {error}
        </p>
      )}
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted">{caption}</p>
          <p className={`flex items-baseline gap-3 leading-none ${frame.tone ? "text-ink" : "text-ink-muted"}`}>
            <span className="text-[6rem] font-medium tracking-tighter tabular-nums">
              {shown ? HZ_FORMAT.format(shown.hz) : "0"}
            </span>
            <span className="text-4xl">Hz</span>
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 text-lg tabular-nums">
            <dt className="text-ink-muted">level</dt>
            <dd>{shown ? `${shown.levelDb.toFixed(0)} dB` : "n/a"}</dd>
            <dt className="text-ink-muted">above noise</dt>
            <dd>{shown ? `${shown.snrDb.toFixed(0)} dB` : "n/a"}</dd>
            <dt className="text-ink-muted">engine-like hum</dt>
            <dd className={frame.hum ? "font-medium text-warn" : ""}>
              {frame.hum ? `${frame.hum.hz.toFixed(0)} Hz, ${frame.hum.harmonics} overtones` : "none"}
            </dd>
            <dt className="text-ink-muted">to people</dt>
            <dd>
              {!shown
                ? "n/a"
                : shown.hz >= HARD_TO_HEAR_HZ
                  ? "inaudible to most adults"
                  : "audible"}
            </dd>
          </dl>
        </div>
        <SoundSpectrumChart plot={frame.plot} maxHz={frame.maxHz} markerHz={frame.tone?.hz ?? null} />
      </div>
    </Panel>
  );
}
