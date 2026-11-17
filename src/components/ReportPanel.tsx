"use client";

import { useState } from "react";
import { NotePencil } from "@phosphor-icons/react";
import type { LoggedEvent } from "../lib/monitor/log";
import type { ReportRequest, ReportResponse } from "../lib/monitor/report";
import { Button, Panel } from "./ui";

type Props = {
  events: LoggedEvent[];
  baselineHz: number | null;
};

type ReportState =
  | { status: "idle" }
  | { status: "writing" }
  | { status: "done"; report: string }
  | { status: "failed"; message: string };

const NETWORK_ERROR = "The report service did not respond. Check that the app is still running, then try again.";

export function ReportPanel({ events, baselineHz }: Props) {
  const [assetName, setAssetName] = useState("Test cable");
  const [state, setState] = useState<ReportState>({ status: "idle" });

  const handleWrite = async () => {
    setState({ status: "writing" });
    const body: ReportRequest = {
      assetName,
      baselineHz,
      events: events.map(({ at, hz, deviationPct, amplitudePx, health }) => ({
        at,
        hz,
        deviationPct,
        amplitudePx,
        health,
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
    <Panel title="Morning report">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          What the camera is watching
          <input
            value={assetName}
            maxLength={80}
            onChange={(event) => setAssetName(event.target.value)}
            className="h-9 w-64 rounded-control bg-surface px-2 text-sm text-ink"
          />
        </label>
        <Button
          variant="primary"
          onClick={() => void handleWrite()}
          disabled={events.length === 0 || assetName.trim() === "" || state.status === "writing"}
        >
          <NotePencil size={16} weight="bold" />
          {state.status === "writing" ? "Writing report" : "Write report from the log"}
        </Button>
      </div>
      {state.status === "idle" && (
        <p className="text-sm text-ink-muted">
          The agent reads the whole watch log and writes what changed, when, and what to inspect first.
        </p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-sm text-crit">
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <p className="max-w-[65ch] text-sm leading-relaxed whitespace-pre-wrap">{state.report}</p>
      )}
    </Panel>
  );
}
