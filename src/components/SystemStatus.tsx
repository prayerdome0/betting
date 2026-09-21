"use client";
import { Check, Clock3, Server, ShieldCheck, WifiOff } from "lucide-react";
import type { ServiceHealth } from "@/lib/trading/status";
import { Badge, date, PanelHead } from "./ui";
import { IDENTITY_SOURCE_LABEL } from "@/lib/trading/status";
export default function SystemStatus({
  health,
  connection,
  browserOnline,
}: {
  health: ServiceHealth | null;
  connection: string;
  browserOnline: boolean;
}) {
  const identityNote = health
    ? health.identitySource
      ? `Source: ${IDENTITY_SOURCE_LABEL[health.identitySource] ?? health.identitySource}`
      : "Hosting-side Firebase credentials"
    : "Hosting-side Firebase credentials";
  const checks = [
    ["Server identity", health?.checks.identity, identityNote],
    ["Firestore access", health?.checks.database, "Persistent source of truth"],
    [
      "Independent worker",
      health?.checks.worker,
      "Runs even with the browser closed",
    ],
    [
      "Synthetic market feed",
      health?.checks.feed,
      "Fresh, validated observations",
    ],
  ] as const;
  return (
    <section className="panel system-status">
      <PanelHead
        title="System connection"
        subtitle="Actual service readiness — not a simulated status indicator"
      />
      <div className="system-status-body">
        <div className="system-status-summary">
          <Server size={21} />
          <div>
            <strong>
              {health?.status.replaceAll("_", " ") || "CHECKING CONNECTION"}
            </strong>
            <p>
              {health?.message ||
                "Checking server readiness. Trading cannot start until the worker and market feed are available."}
            </p>
          </div>
          <Badge tone={health?.status === "READY" ? "green" : "neutral"}>
            {health?.environment === "FIREBASE_EMULATOR"
              ? "LOCAL EMULATORS"
              : "FIREBASE"}
          </Badge>
        </div>
        <div className="system-checks">
          {checks.map(([label, ok, note]) => (
            <div key={label}>
              <span className={ok ? "check-ok" : "check-pending"}>
                {ok ? <Check size={15} /> : <Clock3 size={15} />}
              </span>
              <div>
                <strong>{label}</strong>
                <small>{note}</small>
              </div>
              <b>{health ? (ok ? "Connected" : "Not ready") : "Checking"}</b>
            </div>
          ))}
        </div>
        <div className="system-status-foot">
          {browserOnline ? <ShieldCheck size={14} /> : <WifiOff size={14} />}
          <span>{connection}</span>
          <span>Worker heartbeat: {date(health?.heartbeatAt)}</span>
        </div>
        {health && health.status !== "READY" && (
          <details className="setup-instructions">
            <summary>Deployment checklist</summary>
            <ol>
              {health.status === "SERVER_STARTUP_FAILED" && (
                <li>
                  The server code did not start on this host, so none of the
                  checks below could run. Read the reason above: redeploy with{" "}
                  <code>node_modules</code> intact and the build output
                  unchanged, on Node.js 22.12 or newer.
                </li>
              )}
              <li>
                Enable Email/Password authentication and create Firestore in
                Firebase Console.
              </li>
              <li>
                Give the server a Firebase identity: set{" "}
                <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> (or{" "}
                <code>FIREBASE_CLIENT_EMAIL</code> +{" "}
                <code>FIREBASE_PRIVATE_KEY</code>) in your hosting environment,
                or attach Application Default Credentials. Without it, sign-in
                succeeds but accounts can never be created. Never enter Admin
                keys in this website.
              </li>
              <li>
                Deploy <code>firestore.rules</code> and{" "}
                <code>firestore.indexes.json</code> using an authorized Firebase
                CLI.
              </li>
              <li>
                Run <code>npm run worker</code> as a separate, supervised
                service. Deploying the web app alone does not run it.
              </li>
            </ol>
            <p>
              Full production and isolated-emulator instructions are in the
              project’s README.md. This check does not verify deployed Security
              Rules or Auth provider configuration; those require the Firebase
              integration tests.
            </p>
          </details>
        )}
      </div>
    </section>
  );
}
