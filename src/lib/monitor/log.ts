export interface Reading {
  hz: number;
  snr: number;
  amplitudePx: number;
  at: number;
}

export type Health = "unknown" | "healthy" | "drift" | "fault";

export interface LoggedEvent extends Reading {
  id: number;
  deviationPct: number | null;
  health: Health;
}

export interface LogState {
  baseline: Reading | null;
  last: Reading | null;
  events: LoggedEvent[];
}

export type LogAction =
  | { type: "reading"; reading: Reading }
  | { type: "setBaseline" }
  | { type: "clear" };

export const DRIFT_PCT = 5;
export const FAULT_PCT = 15;
const MAX_EVENTS = 500;

export const HEALTH_LABEL: Record<Health, string> = {
  unknown: "No baseline",
  healthy: "Healthy",
  drift: "Drifting",
  fault: "Fault",
};

export const initialLog: LogState = { baseline: null, last: null, events: [] };

export function deviationPct(hz: number, baseline: Reading | null): number | null {
  return baseline ? ((hz - baseline.hz) / baseline.hz) * 100 : null;
}

export function classify(deviation: number | null): Health {
  if (deviation === null) return "unknown";
  const size = Math.abs(deviation);
  if (size < DRIFT_PCT) return "healthy";
  return size < FAULT_PCT ? "drift" : "fault";
}

export function logReducer(state: LogState, action: LogAction): LogState {
  if (action.type === "clear") return initialLog;
  if (action.type === "setBaseline") return { ...state, baseline: state.last };

  const deviation = deviationPct(action.reading.hz, state.baseline);
  const event: LoggedEvent = {
    ...action.reading,
    id: action.reading.at,
    deviationPct: deviation,
    health: classify(deviation),
  };
  return {
    ...state,
    last: action.reading,
    events: [event, ...state.events].slice(0, MAX_EVENTS),
  };
}
