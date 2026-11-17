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
      <p className="text-sm text-ink-muted">
        Every vibration the camera reads is logged here with its frequency and how far it sits from the baseline.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-left font-mono text-sm tabular-nums">
        <thead className="sticky top-0 bg-panel font-sans text-xs text-ink-muted">
          <tr>
            <th className="py-1.5 pr-4 font-medium">Time</th>
            <th className="py-1.5 pr-4 font-medium">Frequency</th>
            <th className="py-1.5 pr-4 font-medium">Change</th>
            <th className="py-1.5 pr-4 font-medium">Movement</th>
            <th className="py-1.5 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-t border-line">
              <td className="py-1.5 pr-4">{TIME_FORMAT.format(event.at)}</td>
              <td className="py-1.5 pr-4">{formatHz(event.hz)} Hz</td>
              <td className="py-1.5 pr-4">{formatDeviation(event.deviationPct)}</td>
              <td className="py-1.5 pr-4">{event.amplitudePx.toFixed(1)} px</td>
              <td className="py-1.5">
                <HealthPill health={event.health} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
