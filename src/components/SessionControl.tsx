"use client";
import { useState } from "react";
import {
  Bot,
  Clock3,
  Pause,
  Play,
  Square,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import type { Account, Session } from "@/lib/trading/types";
import { Badge, money, timeLeft } from "./ui";
export default function SessionControl({
  session,
  account,
  now,
  busy,
  command,
  signIn,
  online,
}: {
  session: Session | null;
  account: Account | null;
  now: number;
  busy: boolean;
  command: (body: unknown) => Promise<boolean>;
  signIn: () => void;
  online: boolean;
}) {
  const [duration, setDuration] = useState("600");
  const [custom, setCustom] = useState("15");
  const live =
    session && ["ACTIVE", "PAUSED", "STOPPING"].includes(session.status);
  const remaining = session?.expiresAt == null ? null : session.expiresAt - now;
  const progress = session?.expiresAt
    ? Math.min(
        100,
        Math.max(
          0,
          ((now - session.startedAt) /
            (session.expiresAt - session.startedAt)) *
            100,
        ),
      )
    : 0;
  return (
    <section className="panel session-card">
      <div className="session-top">
        <div className="bot-icon">
          <Bot size={22} />
        </div>
        <div>
          <h3>AI trading session</h3>
          <p>Autonomous. Auditable. Simulated.</p>
        </div>
        <Badge
          tone={session?.status === "ACTIVE" && online ? "green" : "neutral"}
        >
          {session?.status === "ACTIVE"
            ? online
              ? "ACTIVE"
              : "OFFLINE"
            : session?.status === "PAUSED"
              ? "PAUSED"
              : "STANDBY"}
        </Badge>
      </div>
      <div className="session-status">
        <span className={live && online ? "pulse-dot" : "quiet-dot"} />
        {live ? session.aiStatus : session?.aiStatus || "AI STOPPED"}
        <span>RULES ENGINE v1.0</span>
      </div>
      <div className="timer">
        <Clock3 size={19} />
        <span>
          {live
            ? session.status === "STOPPING"
              ? "Stopping…"
              : timeLeft(remaining)
            : "Ready when you are"}
        </span>
        <small>
          {live
            ? remaining !== null && remaining <= 0
              ? "Settling final positions"
              : "remaining in session"
            : "Choose a duration to get started"}
        </small>
      </div>
      {live && (
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
      )}
      {!live ? (
        <>
          <label className="duration-label">
            Session duration
            <select
              aria-label="Session duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {[
                [300, "5 minutes"],
                [600, "10 minutes"],
                [1800, "30 minutes"],
                [3600, "1 hour"],
                [7200, "2 hours"],
                [10800, "3 hours"],
                [18000, "5 hours"],
                [36000, "10 hours"],
                [86400, "24 hours"],
                ["custom", "Custom duration"],
                ["unlimited", "Unlimited"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {duration === "custom" && (
            <label>
              Custom duration (minutes, 1–10,080)
              <input
                type="number"
                min="1"
                max="10080"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
          )}
        </>
      ) : (
        <div className="session-numbers">
          <div>
            <span>Session P/L</span>
            <b className={session.totalPnlCents < 0 ? "negative" : "positive"}>
              {money(session.totalPnlCents, true)}
            </b>
          </div>
          <div>
            <span>Trades generated</span>
            <b>{session.tradesGenerated}</b>
          </div>
          <div>
            <span>Started</span>
            <b>
              {new Date(session.startedAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>
          </div>
        </div>
      )}
      {session?.engineError && (
        <div className="session-engine-error" role="alert">
          <strong>Execution interrupted</strong>
          <p>{session.engineError.message}</p>
          <small>
            {new Date(session.engineError.occurredAt).toLocaleString()}
          </small>
        </div>
      )}
      <div className="session-actions">
        {live ? (
          <>
            {session.status !== "STOPPING" && (
              <button
                className="button secondary"
                disabled={busy || (session.status === "PAUSED" && !online)}
                onClick={() =>
                  void command({
                    action: session.status === "PAUSED" ? "resume" : "pause",
                  })
                }
              >
                {session.status === "PAUSED" ? (
                  <Play size={15} />
                ) : (
                  <Pause size={15} />
                )}{" "}
                {session.status === "PAUSED" ? "Resume AI" : "Pause"}
              </button>
            )}
            <button
              className="button danger"
              disabled={busy || session.status === "STOPPING"}
              onClick={() => void command({ action: "stop" })}
            >
              <Square size={13} fill="currentColor" />
              STOP AI TRADING
            </button>
          </>
        ) : (
          <button
            className="button primary wide"
            disabled={
              busy ||
              (!!account && !online) ||
              (duration === "custom" &&
                (!Number.isInteger(Number(custom)) ||
                  Number(custom) < 1 ||
                  Number(custom) > 10080))
            }
            onClick={() =>
              account
                ? void command({
                    action: "start",
                    durationSeconds:
                      duration === "unlimited"
                        ? null
                        : duration === "custom"
                          ? Number(custom) * 60
                          : Number(duration),
                  })
                : signIn()
            }
          >
            <Play size={15} fill="currentColor" />
            {busy ? "Starting…" : "Start AI trading"}
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      <div className="session-note">
        <ShieldCheck size={14} />
        <span>
          {live
            ? "Deadlines persist. Pausing never extends the timer."
            : "No real orders. No guaranteed returns."}
        </span>
      </div>
      {account && !online && (
        <p className="offline-note">
          Worker offline — new sessions are blocked. Deploy or restart the
          independent worker.
        </p>
      )}
    </section>
  );
}
