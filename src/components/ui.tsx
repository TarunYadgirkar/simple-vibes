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
    <section className={`flex flex-col gap-3 border-t border-line pt-3 ${className}`}>
      {(title || action) && (
        <header className="flex items-baseline justify-between gap-3">
          {title && <h2 className="text-ink-muted">{title}</h2>}
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
  primary: "text-action font-medium",
  quiet: "text-ink",
};

export function Button({ variant = "quiet", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`cursor-pointer py-1 underline-offset-4 hover:underline disabled:cursor-default disabled:text-ink-muted disabled:no-underline ${BUTTON_VARIANT[variant]} ${className}`}
    >
      [{children}]
    </button>
  );
}

export const FIELD_CLASS =
  "h-8 border-b border-line bg-transparent text-ink tabular-nums hover:border-ink-muted";

const HEALTH_STYLE: Record<Health, string> = {
  unknown: "text-ink-muted",
  healthy: "text-good",
  drift: "text-warn",
  fault: "text-crit",
};

export function HealthPill({ health }: { health: Health }) {
  return <span className={`font-medium whitespace-nowrap ${HEALTH_STYLE[health]}`}>{HEALTH_LABEL[health].toLowerCase()}</span>;
}

export function formatHz(hz: number): string {
  return hz.toFixed(2);
}

export function formatDeviation(pct: number | null): string {
  if (pct === null) return "n/a";
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}
