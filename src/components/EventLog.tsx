import { Fragment } from "react";
import type { LoggedEvent } from "../lib/monitor/log";
import { formatDeviation, formatHz, HealthPill } from "./ui";

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function EventLog({ events }: { events: LoggedEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-ink-muted">
        no readings yet
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-left tabular-nums">
        <thead className="sticky top-0 bg-page text-ink-muted">
          <tr>
            <th className="py-1.5 pr-4 font-normal">time</th>
            <th className="py-1.5 pr-4 font-normal">sensor</th>
            <th className="py-1.5 pr-4 font-normal">frequency</th>
            <th className="py-1.5 pr-4 font-normal">change</th>
            <th className="py-1.5 pr-4 font-normal">strength</th>
            <th className="py-1.5 font-normal">state</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <Fragment key={event.id}>
            <tr className="border-t border-line">
              <td className="py-1.5 pr-4">{TIME_FORMAT.format(event.at)}</td>
              <td className="py-1.5 pr-4">{event.sensor}</td>
              <td className="py-1.5 pr-4">{formatHz(event.hz)} Hz</td>
              <td className="py-1.5 pr-4">{formatDeviation(event.deviationPct)}</td>
              <td className="py-1.5 pr-4">
                {event.kind === "vibration" && `${event.amplitudePx.toFixed(1)} px`}
                {event.levelDb !== null && `${event.levelDb.toFixed(0)} dB`}
              </td>
              <td className="py-1.5">
                {event.kind === "vibration" && <HealthPill health={event.health} />}
                {event.kind === "tone" && "heard"}
                {event.kind === "hum" && <span className="text-xl font-medium text-warn">hum</span>}
              </td>
            </tr>
            {event.note && (
              <tr>
                <td />
                <td colSpan={5} className="max-w-[65ch] pb-2 text-ink-muted">
                  {event.kind === "vibration" ? `agent: ${event.note}` : event.note}
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
