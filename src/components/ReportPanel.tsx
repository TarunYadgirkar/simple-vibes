"use client";

import { useState } from "react";
import type { LoggedEvent } from "../lib/monitor/log";
import type { ReportRequest, ReportResponse } from "../lib/monitor/report";
import { Button, FIELD_CLASS, Panel } from "./ui";

type Props = {
  events: LoggedEvent[];
  baselineHz: number | null;
  assetName: string;
  onAssetNameChange: (name: string) => void;
};

type ReportState =
  | { status: "idle" }
  | { status: "writing" }
  | { status: "done"; report: string }
  | { status: "failed"; message: string };

const NETWORK_ERROR = "The report service did not respond. Check that the app is still running, then try again.";

export function ReportPanel({ events, baselineHz, assetName, onAssetNameChange }: Props) {
  const [state, setState] = useState<ReportState>({ status: "idle" });

  const handleWrite = async () => {
    setState({ status: "writing" });
    const body: ReportRequest = {
      assetName,
      baselineHz,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      events: events.map(({ at, hz, deviationPct, amplitudePx, health, note }) => ({
        at,
        hz,
        deviationPct,
        amplitudePx,
        health,
        note,
      })),
    };
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ReportResponse;
      setState(
        "report" in result
          ? { status: "done", report: result.report }
          : { status: "failed", message: result.error },
      );
    } catch {
      setState({ status: "failed", message: NETWORK_ERROR });
    }
  };

  return (
    <Panel title="morning report">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-ink-muted">
          what the camera is watching
          <input
            value={assetName}
            maxLength={80}
            onChange={(event) => onAssetNameChange(event.target.value)}
            className={`${FIELD_CLASS} w-64`}
          />
        </label>
        <Button
          variant="primary"
          onClick={() => void handleWrite()}
          disabled={events.length === 0 || assetName.trim() === "" || state.status === "writing"}
        >
          {state.status === "writing" ? "writing report" : "write report from the log"}
        </Button>
      </div>
      {state.status === "idle" && (
        <p className="max-w-[65ch] text-ink-muted">
          The agent reads the whole watch log and writes what changed, when, and what to inspect first.
        </p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-crit">
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <p className="max-w-[65ch] leading-relaxed whitespace-pre-wrap">{state.report}</p>
      )}
    </Panel>
  );
}
