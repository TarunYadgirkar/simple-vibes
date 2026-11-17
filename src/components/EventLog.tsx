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
        Every vibration the camera reads is logged here with its frequency and how far it sits from the baseline.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-left tabular-nums">
        <thead className="sticky top-0 bg-page text-ink-muted">
          <tr>
            <th className="py-1.5 pr-4 font-normal">time</th>
            <th className="py-1.5 pr-4 font-normal">frequency</th>
            <th className="py-1.5 pr-4 font-normal">change</th>
            <th className="py-1.5 pr-4 font-normal">movement</th>
            <th className="py-1.5 font-normal">state</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <Fragment key={event.id}>
            <tr className="border-t border-line">
              <td className="py-1.5 pr-4">{TIME_FORMAT.format(event.at)}</td>
              <td className="py-1.5 pr-4">{formatHz(event.hz)} Hz</td>
              <td className="py-1.5 pr-4">{formatDeviation(event.deviationPct)}</td>
              <td className="py-1.5 pr-4">{event.amplitudePx.toFixed(1)} px</td>
              <td className="py-1.5">
                <HealthPill health={event.health} />
              </td>
            </tr>
            {event.note && (
              <tr>
                <td />
                <td colSpan={4} className="max-w-[65ch] pb-2 text-ink-muted">
                  agent: {event.note}
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
