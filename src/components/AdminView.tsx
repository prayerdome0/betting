"use client";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/useTrading";
import type { Account } from "@/lib/trading/types";
import { Badge, date, Empty, money, PanelHead } from "./ui";
type Row = Record<string, unknown>;
export default function AdminView({ user }: { user: User }) {
  const [users, setUsers] = useState<Account[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [kind, setKind] = useState("trades");
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [userNext, setUserNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loadUsers = useCallback(
    async (cursor?: string) => {
      setBusy(true);
      try {
        const data = await api(
          user,
          `/api/admin${cursor ? `?cursor=${cursor}` : ""}`,
        );
        setUsers((p) => (cursor ? [...p, ...data.users] : data.users));
        setUserNext(data.next);
        setEvents(data.events);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [user],
  );
  const inspect = useCallback(
    async (uid: string, view: string, cursor?: string) => {
      setBusy(true);
      setError("");
      try {
        const data = await api(
          user,
          `/api/admin?uid=${encodeURIComponent(uid)}&kind=${view}${cursor ? `&cursor=${cursor}` : ""}`,
        );
        setRows((p) => (cursor ? [...p, ...data.rows] : data.rows));
        setNext(data.next);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [user],
  );
  useEffect(() => {
    void Promise.resolve().then(() => loadUsers());
    const interval = setInterval(() => void loadUsers(), 30000);
    return () => clearInterval(interval);
  }, [loadUsers]);
  useEffect(() => {
    if (!selected) return;
    void Promise.resolve().then(() => inspect(selected, kind));
    const timer = setInterval(() => void inspect(selected, kind), 15000);
    return () => clearInterval(timer);
  }, [selected, kind, inspect]);
  async function update(id: string, status: string) {
    setBusy(true);
    try {
      await api(user, "/api/admin", { uid: selected, id, status });
      await inspect(selected, kind);
      await loadUsers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="simulation-notice">
        <ShieldCheck size={20} />
        <div>
          <strong>Read-only trading oversight</strong>
          <p>
            Balances and trading results cannot be edited here. Withdrawal
            workflow changes are audited and never transfer real funds.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void loadUsers()}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <section className="panel">
        <PanelHead
          title="Registered accounts"
          subtitle="Firestore profiles · updated every 30 seconds"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Simulated balance</th>
                <th>Total P/L</th>
                <th>Trades</th>
                <th>Session</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((a) => (
                <tr key={a.uid}>
                  <td>
                    <strong>{a.name}</strong>
                    <small>{a.email}</small>
                  </td>
                  <td>{money(a.balanceCents)}</td>
                  <td>{money(a.totalPnlCents, true)}</td>
                  <td>{a.trades}</td>
                  <td>
                    <Badge tone={a.activeSessionId ? "green" : "neutral"}>
                      {a.activeSessionId
                        ? "Current session"
                        : "No active session"}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(a.uid)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {userNext && (
          <button
            className="button secondary load-more"
            disabled={busy}
            onClick={() => void loadUsers(userNext)}
          >
            Load more accounts
          </button>
        )}
      </section>
      {selected && (
        <section className="panel ledger-panel">
          <PanelHead
            title={`Account inspection · ${users.find((a) => a.uid === selected)?.name || selected}`}
            subtitle="Read-only history · requests can be reviewed below"
          />
          <div className="table-toolbar">
            <select
              aria-label="Inspect record type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="trades">Trades & P/L</option>
              <option value="tradingSessions">
                Active / completed sessions
              </option>
              <option value="withdrawals">
                Withdrawal simulation requests
              </option>
              <option value="activity">System activity</option>
              <option value="ledger">Balance ledger</option>
            </select>
          </div>
          {rows.length ? (
            <div className="admin-records">
              {rows.map((row, i) => (
                <div className="admin-record" key={String(row.id || i)}>
                  <pre>{JSON.stringify(row, null, 2)}</pre>
                  {kind === "withdrawals" &&
                    ["Submitted", "Under Review"].includes(
                      String(row.status),
                    ) && (
                      <div className="button-row">
                        {row.status === "Submitted" ? (
                          <button
                            disabled={busy}
                            className="button secondary"
                            onClick={() =>
                              void update(String(row.id), "Under Review")
                            }
                          >
                            Mark under review
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            className="button primary"
                            onClick={() =>
                              void update(String(row.id), "Simulated Completed")
                            }
                          >
                            Complete simulation
                          </button>
                        )}
                        <button
                          disabled={busy}
                          className="button secondary"
                          onClick={() =>
                            void update(String(row.id), "Cancelled")
                          }
                        >
                          Cancel request
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No records"
              text="This account has no records in this category."
            />
          )}
          {next && (
            <button
              className="button secondary load-more"
              disabled={busy}
              onClick={() => void inspect(selected, kind, next)}
            >
              Load more records
            </button>
          )}
        </section>
      )}
      <section className="panel ledger-panel">
        <PanelHead
          title="System events & errors"
          subtitle="Latest 50 protected server events"
        />
        {events.length ? (
          <div className="activity-list">
            {events.map((e, i) => (
              <div className="activity-item" key={String(e.id || i)}>
                <span className="activity-dot" />
                <div>
                  <strong>{String(e.kind)}</strong>
                  <p>{String(e.message)}</p>
                  <time>{date(Number(e.timestamp))}</time>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No system events"
            text="Server errors and admin workflow changes appear here."
          />
        )}
      </section>
    </>
  );
}
