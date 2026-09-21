"use client";
import { useDialog } from "@/lib/useDialog";
import type { ReactNode } from "react";
import { ArrowUpRight, X } from "lucide-react";
export function money(cents: number | null | undefined, signed = false) {
  return cents == null
    ? "—"
    : `${signed && cents > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)}`;
}
export function date(time: number | null | undefined) {
  return time
    ? new Date(time).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}
export function timeLeft(ms: number | null) {
  if (ms === null) return "Unlimited";
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return `${h ? `${h.toString().padStart(2, "0")}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function PanelHead({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-head">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
export function Empty({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useDialog();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Sparkline({
  points,
  negative = false,
}: {
  points: number[];
  negative?: boolean;
}) {
  if (points.length < 2) return <span className="muted">—</span>;
  const min = Math.min(...points),
    range = Math.max(...points) - min || 1;
  return (
    <svg
      className={`sparkline ${negative ? "negative" : ""}`}
      viewBox="0 0 100 32"
      role="img"
      aria-label="Synthetic price trend"
    >
      <polyline
        points={points
          .map(
            (p, i) =>
              `${(i / (points.length - 1)) * 100},${28 - ((p - min) / range) * 24}`,
          )
          .join(" ")}
      />
    </svg>
  );
}
export function Chart({
  points,
  empty,
  label,
}: {
  points: { time: number; value: number }[];
  empty: string;
  label: string;
}) {
  const min = Math.min(...points.map((p) => p.value)),
    max = Math.max(...points.map((p) => p.value));
  const pad = Math.max((max - min) * 0.2, Math.abs(max) * 0.002, 0.01);
  const range = max - min + pad * 2;
  const coords = points
    .map(
      (p, i) =>
        `${points.length === 1 ? 0 : (i / (points.length - 1)) * 800},${190 - ((p.value - min + pad) / range) * 160}`,
    )
    .join(" ");
  return (
    <div className="chart-container">
      <div className="chart-grid">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>
            <span>
              {points.length
                ? (max + pad - (i * range) / 4).toLocaleString("en-US", {
                    maximumFractionDigits: max > 10 ? 2 : 5,
                  })
                : "—"}
            </span>
          </div>
        ))}
      </div>
      {points.length > 1 ? (
        <svg
          viewBox="0 0 800 210"
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.19" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,210 ${coords} 800,210`} fill="url(#chartFill)" />
          <polyline
            points={coords}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="chart-empty">
          <span className="mini-pulse" />
          <b>{empty}</b>
          <span>Only recorded data appears here. No invented results.</span>
        </div>
      )}
      <div className="chart-axis">
        <span>{points.length ? date(points[0].time) : "SESSION START"}</span>
        <span>
          {points.length > 1 ? date(points[points.length - 1].time) : "NOW"}
        </span>
      </div>
    </div>
  );
}
