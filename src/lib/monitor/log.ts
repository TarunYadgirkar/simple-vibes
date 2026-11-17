export interface Reading {
  hz: number;
  snr: number;
  amplitudePx: number;
  at: number;
}

export type Health = "unknown" | "healthy" | "drift" | "fault";

export type Sensor = "camera" | "mic";

export interface LoggedEvent extends Reading {
  id: number;
  sensor: Sensor;
  levelDb: number | null;
  deviationPct: number | null;
  health: Health;
  note: string | null;
}

export interface LogState {
  baseline: Reading | null;
  baselineImage: string | null;
  last: Reading | null;
  events: LoggedEvent[];
}

export type LogAction =
  | { type: "reading"; reading: Reading; note: string | null }
  | { type: "tone"; hz: number; levelDb: number; snrDb: number; at: number }
  | { type: "note"; id: number; note: string }
  | { type: "setBaseline"; image: string | null }
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

export const initialLog: LogState = { baseline: null, baselineImage: null, last: null, events: [] };

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
  if (action.type === "setBaseline") {
    return { ...state, baseline: state.last, baselineImage: action.image };
  }
  if (action.type === "note") {
    return {
      ...state,
      events: state.events.map((event) =>
        event.id === action.id ? { ...event, note: action.note } : event,
      ),
    };
  }

  if (action.type === "tone") {
    const heard: LoggedEvent = {
      id: action.at,
      sensor: "mic",
      hz: action.hz,
      snr: action.snrDb,
      amplitudePx: 0,
      levelDb: action.levelDb,
      at: action.at,
      deviationPct: null,
      health: "unknown",
      note: null,
    };
    return { ...state, events: [heard, ...state.events].slice(0, MAX_EVENTS) };
  }

  const deviation = deviationPct(action.reading.hz, state.baseline);
  const event: LoggedEvent = {
    ...action.reading,
    id: action.reading.at,
    sensor: "camera",
    levelDb: null,
    deviationPct: deviation,
    health: classify(deviation),
    note: action.note,
  };
  return {
    ...state,
    last: action.reading,
    events: [event, ...state.events].slice(0, MAX_EVENTS),
  };
}
