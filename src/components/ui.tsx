import type { ButtonHTMLAttributes, ReactNode } from "react";
import { HEALTH_LABEL, type Health } from "../lib/monitor/log";

interface PanelProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, action, children, className = "" }: PanelProps) {
  return (
    <section className={`flex flex-col gap-3 rounded-panel bg-panel p-4 shadow-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "quiet";
}

const BUTTON_VARIANT = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  quiet: "bg-surface text-ink hover:bg-line",
};

export function Button({ variant = "quiet", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-control px-3 text-sm font-medium transition-[scale,background-color,filter] duration-150 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 ${BUTTON_VARIANT[variant]} ${className}`}
    />
  );
}

const HEALTH_STYLE: Record<Health, string> = {
  unknown: "bg-surface text-ink-muted",
  healthy: "bg-good/12 text-good",
  drift: "bg-warn/15 text-warn",
  fault: "bg-crit/12 text-crit",
};

const HEALTH_DOT: Record<Health, string> = {
  unknown: "bg-ink-muted",
  healthy: "bg-good",
  drift: "bg-warn",
  fault: "bg-crit",
};

export function HealthPill({ health }: { health: Health }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${HEALTH_STYLE[health]}`}
    >
      <span className={`size-1.5 rounded-full ${HEALTH_DOT[health]}`} />
      {HEALTH_LABEL[health]}
    </span>
  );
}

export function formatHz(hz: number): string {
  return hz.toFixed(2);
}

export function formatDeviation(pct: number | null): string {
  if (pct === null) return "n/a";
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}
