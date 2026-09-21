"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  Check,
  Save,
  ShieldCheck,
  Wallet,
  SlidersHorizontal,
  ReceiptText,
} from "lucide-react";
import type {
  Account,
  LedgerEntry,
  Settings,
  Withdrawal,
} from "@/lib/trading/types";
import { SYMBOLS } from "@/lib/trading/types";
import { Badge, Empty, money, date, PanelHead } from "./ui";
export function SettingsView({
  account,
  command,
  busy,
}: {
  account: Account;
  command: (body: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const [name, setName] = useState(account.name);
  const [settings, setSettings] = useState<Settings>(account.settings);
  const [balance, setBalance] = useState("500");
  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((p) => ({ ...p, [key]: value }));
  }
  return (
    <div className="settings-grid">
      <section className="panel">
        <PanelHead
          title="Trading preferences"
          subtitle="Versioned strategy settings · apply to your next session"
        />
        <form
          className="form-content"
          onSubmit={(e) => {
            e.preventDefault();
            void command({ action: "settings", name, settings });
          }}
        >
          <div className="form-section-title">
            <SlidersHorizontal size={17} /> Your strategy
          </div>
          <div className="form-grid">
            <label>
              Display name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Account email
              <input value={account.email} disabled />
            </label>
            <label>
              Strategy
              <select
                value={settings.strategy}
                onChange={(e) =>
                  set("strategy", e.target.value as Settings["strategy"])
                }
              >
                <option value="MOMENTUM">Momentum following</option>
                <option value="MEAN_REVERSION">Mean reversion</option>
              </select>
            </label>
            <label>
              Trade allocation (USD)
              <input
                type="number"
                required
                min="1"
                max="25000"
                step="0.01"
                value={settings.tradeAmountCents / 100}
                onChange={(e) =>
                  set(
                    "tradeAmountCents",
                    Math.round(Number(e.target.value) * 100),
                  )
                }
              />
            </label>
            <label>
              Maximum open positions
              <select
                value={settings.maxPositions}
                onChange={(e) => set("maxPositions", Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Maximum holding time (seconds)
              <input
                type="number"
                required
                min="20"
                max="3600"
                value={settings.maxHoldSeconds}
                onChange={(e) => set("maxHoldSeconds", Number(e.target.value))}
              />
            </label>
            <label>
              Stop loss (%)
              <input
                type="number"
                required
                min="0.05"
                max="5"
                step="0.05"
                value={settings.stopLossPct}
                onChange={(e) => set("stopLossPct", Number(e.target.value))}
              />
            </label>
            <label>
              Take profit (%)
              <input
                type="number"
                required
                min="0.05"
                max="10"
                step="0.05"
                value={settings.takeProfitPct}
                onChange={(e) => set("takeProfitPct", Number(e.target.value))}
              />
            </label>
            <label>
              Session loss limit (%)
              <input
                type="number"
                required
                min="1"
                max="25"
                value={settings.maxSessionLossPct}
                onChange={(e) =>
                  set("maxSessionLossPct", Number(e.target.value))
                }
              />
            </label>
          </div>
          <label>Markets to monitor</label>
          <div className="market-checks">
            {SYMBOLS.map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={settings.markets.includes(s)}
                  onChange={(e) =>
                    set(
                      "markets",
                      e.target.checked
                        ? [...settings.markets, s]
                        : settings.markets.filter((m) => m !== s),
                    )
                  }
                />
                {s}
              </label>
            ))}
          </div>
          <div className="info-box">
            <ShieldCheck size={18} />
            <p>
              Each position is capped at 25% of the balance, with no leverage.
              Round-trip simulation fees: 2 basis points. Stops execute at the
              next observed quote, not a guaranteed price.
            </p>
          </div>
          <button
            disabled={busy || !settings.markets.length}
            className="button primary"
            type="submit"
          >
            <Save size={16} />
            Save settings
          </button>
        </form>
      </section>
      <div className="view-stack">
        <section className="panel">
          <PanelHead
            title="Simulated funds"
            subtitle="Configure your practice capital"
          />
          <form
            className="form-content"
            onSubmit={(e) => {
              e.preventDefault();
              void command({
                action: "balance",
                balanceCents: Math.round(Number(balance) * 100),
              });
            }}
          >
            <p className="body-copy">
              Your current simulated balance is{" "}
              <b>{money(account.balanceCents)}</b>. Set a new practice balance
              without erasing your trade history.
            </p>
            <label>
              New simulated balance (USD)
              <input
                required
                type="number"
                min="10"
                max="100000"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </label>
            <button
              disabled={
                busy ||
                !!account.activeSessionId ||
                account.withdrawalHoldCents > 0
              }
              className="button secondary wide"
              type="submit"
            >
              <Wallet size={16} />
              Configure virtual balance
            </button>
            <small className="helper">
              Only available with no active session or withdrawal hold. Every
              adjustment is recorded in the account ledger.
            </small>
          </form>
        </section>
        <section className="panel account-info">
          <div className="form-section-title">
            <ShieldCheck size={18} /> Account details
          </div>
          <dl>
            <div>
              <dt>Account type</dt>
              <dd>
                <Badge tone="green">SIMULATION</Badge>
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>USD</dd>
            </div>
            <div>
              <dt>Welcome balance</dt>
              <dd>$10.00 · once per account</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{date(account.createdAt)}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>Firebase Firestore</dd>
            </div>
          </dl>
          <p className="helper">
            Balances and execution are server-authoritative. This account cannot
            place live broker orders.
          </p>
        </section>
      </div>
    </div>
  );
}
export function WithdrawalView({
  account,
  withdrawals,
  ledger,
  busy,
  command,
}: {
  account: Account;
  withdrawals: Withdrawal[];
  ledger: LedgerEntry[];
  busy: boolean;
  command: (body: unknown) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState(account.name);
  const [method, setMethod] = useState("Bank transfer");
  const [details, setDetails] = useState("");
  const available =
    account.balanceCents - account.reservedCents - account.withdrawalHoldCents;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await command({
        action: "withdraw",
        amountCents: Math.round(Number(amount) * 100),
        name,
        method,
        details,
      })
    ) {
      setAmount("");
      setDetails("");
    }
  }
  return (
    <>
      <div className="simulation-notice">
        <ShieldCheck size={18} />
        <div>
          <strong>A practice workflow, not a payment</strong>
          <p>
            Withdrawal requests are simulated in this prototype and do not
            transfer real funds. Please use fictional payment details.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <PanelHead
            title="Request a simulated withdrawal"
            subtitle="Virtual funds only · no payment gateway connected"
          />
          <form className="form-content" onSubmit={submit}>
            <div className="available-box">
              <span>Available simulated funds</span>
              <b>{money(available)}</b>
            </div>
            <div className="form-grid">
              <label>
                Amount (USD)
                <input
                  required
                  type="number"
                  min="0.01"
                  max={available / 100}
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Account holder name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </div>
            <label>
              Payment method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>Bank transfer</option>
                <option>PayPal</option>
                <option>USDT (TRC20)</option>
              </select>
            </label>
            <label>
              Fictional account / payment details
              <textarea
                required
                minLength={4}
                maxLength={200}
                placeholder="Use fictional details for this prototype"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>
            <p className="helper">
              Submitting reserves virtual funds. Cancelling releases them. Only
              a simulated completion deducts them from your balance.
            </p>
            <button type="submit" disabled={busy} className="button primary">
              <ArrowDownToLine size={16} />
              Submit simulation request
            </button>
          </form>
        </section>
        <section className="panel">
          <PanelHead
            title="Withdrawal requests"
            subtitle="Latest 100 requests"
          />
          {!withdrawals.length ? (
            <Empty
              title="No requests yet"
              text="Your simulated withdrawal requests will appear here."
              icon={<Wallet size={28} />}
            />
          ) : (
            <div className="request-list">
              {withdrawals.map((w) => (
                <div className="request" key={w.id}>
                  <div>
                    <strong>{money(w.amountCents)}</strong>
                    <Badge
                      tone={
                        w.status === "Simulated Completed" ? "green" : "neutral"
                      }
                    >
                      {w.status}
                    </Badge>
                  </div>
                  <p>
                    {w.method} · {date(w.createdAt)}
                  </p>
                  <small>
                    {w.name} · {w.id.slice(0, 8)}
                  </small>
                  {["Submitted", "Under Review"].includes(w.status) && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void command({ action: "cancelWithdrawal", id: w.id })
                      }
                    >
                      Cancel request
                    </button>
                  )}
                  {w.status === "Simulated Completed" && (
                    <small className="positive">
                      <Check size={12} /> Simulated only. No payment sent.
                    </small>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="panel ledger-panel">
        <PanelHead
          title="Account ledger"
          subtitle="Every balance change, fully traceable · latest 100 entries"
        />
        {ledger.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Timestamp</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Balance after</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <ReceiptText size={14} />
                      {l.type.replaceAll("_", " ")}
                    </td>
                    <td>{date(l.timestamp)}</td>
                    <td className="mono">{l.referenceId.slice(0, 12)}</td>
                    <td className={l.deltaCents < 0 ? "negative" : "positive"}>
                      {money(l.deltaCents, true)}
                    </td>
                    <td>{money(l.balanceAfterCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No transactions"
            text="Your ledger records welcome credit, trade settlements, and virtual-fund changes."
          />
        )}
      </section>
    </>
  );
}
