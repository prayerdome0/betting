"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/lib/simulation/TradingEngineContext";
import { WithdrawalRequest } from "@/types/trading";
import {
  Wallet,
  ArrowDownCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  CreditCard,
  DollarSign,
  HelpCircle,
  RotateCcw,
} from "lucide-react";

export default function WithdrawalView() {
  const {
    balance,
    available,
    withdrawalRequests,
    submitWithdrawal,
    cancelWithdrawal,
    approveWithdrawal,
  } = useTradingEngine();

  const [amount, setAmount] = useState<string>("100");
  const [method, setMethod] = useState<WithdrawalRequest["method"]>("USDT_TRC20");
  const [destination, setDestination] = useState<string>("");
  const [lastSubmitted, setLastSubmitted] = useState<WithdrawalRequest | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Please enter a valid numeric amount greater than 0.");
      return;
    }

    if (numAmount > available) {
      setErrorMsg(
        `Insufficient available demo funds. You have $${available.toFixed(
          2
        )} available.`
      );
      return;
    }

    if (!destination || destination.trim().length < 4) {
      setErrorMsg("Please enter your payment address or account details.");
      return;
    }

    const res = submitWithdrawal(numAmount, method, destination);
    if (res.success && res.request) {
      setLastSubmitted(res.request);
      setDestination("");
    } else {
      setErrorMsg(res.message);
    }
  };

  const getMethodLabel = (m: WithdrawalRequest["method"]) => {
    switch (m) {
      case "USDT_TRC20":
        return "USDT (TRC-20 Network)";
      case "USDT_ERC20":
        return "USDT (ERC-20 Network)";
      case "BANK_WIRE":
        return "Bank Wire (IBAN / SWIFT)";
      case "PAYPAL":
        return "PayPal Account";
      default:
        return m;
    }
  };

  const getDestinationPlaceholder = () => {
    switch (method) {
      case "USDT_TRC20":
        return "e.g. TLsV52Nq4k2X7s8Wz9Qe4...";
      case "USDT_ERC20":
        return "e.g. 0x71C...3984";
      case "BANK_WIRE":
        return "e.g. US89 3704 0044 0532 0130 00";
      case "PAYPAL":
        return "e.g. your-email@example.com";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-[#7ea399] uppercase">
                DEMO FUNDS WITHDRAWAL
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#16362e] text-[#4ee4b8] font-mono">
                SIMULATION PROTOTYPE
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#eef6f4] mt-1">
              Simulated Funds Transfer Request
            </h2>
            <p className="text-xs text-[#6e8e86] mt-0.5">
              Experience the realistic withdrawal request flow without moving real capital.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0d1d1a] border border-[#16382f] text-right">
            <span className="text-xs text-[#708e86] font-semibold block">
              Available Demo Funds
            </span>
            <span className="text-3xl font-black text-[#22d3a0] font-mono">
              ${available.toFixed(2)}
            </span>
            <div className="text-[11px] text-[#55776f]">
              Total Balance: ${balance.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Post-submission Banner - Exactly matches prompt section 5 */}
      {lastSubmitted && (
        <div className="rounded-xl bg-gradient-to-r from-[#0d221c] via-[#0f2821] to-[#0c1f19] border border-[#235848] p-6 shadow-2xl animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#143b2f] border border-[#235e4d] flex items-center justify-center text-[#22d3a0] shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-2 flex-1">
              <h3 className="text-lg font-bold text-[#eef6f4]">
                Withdrawal Request Received
              </h3>
              <p className="text-sm text-[#c6ded8]">
                Your request has been recorded in the prototype demo ledger.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-[#0b1715] border border-[#17302b] text-xs font-mono mt-2">
                <div>
                  <span className="text-[#6e8e86] block text-[10px]">REQUEST ID</span>
                  <span className="font-bold text-[#eef6f4]">{lastSubmitted.id}</span>
                </div>
                <div>
                  <span className="text-[#6e8e86] block text-[10px]">AMOUNT</span>
                  <span className="font-bold text-[#22d3a0]">
                    ${lastSubmitted.amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6e8e86] block text-[10px]">METHOD</span>
                  <span className="text-[#c6ded8]">{lastSubmitted.method}</span>
                </div>
                <div>
                  <span className="text-[#6e8e86] block text-[10px]">STATUS</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#292212] text-[#fbbf24] border border-[#5c491e]">
                    PENDING
                  </span>
                </div>
              </div>

              {/* Explicit disclaimer matching Section 5 */}
              <div className="p-3 rounded-lg bg-[#142320] border border-[#1b3d34] text-xs text-[#8ab2a7] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#22d3a0] shrink-0" />
                <span>
                  <strong>Prototype Notice:</strong> This prototype does not transfer real funds.
                  All balances and withdrawals exist purely in simulation.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Withdrawal Form matching Section 5 */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Method Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#799990] mb-2">
              Select Withdrawal Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "USDT_TRC20", label: "USDT (TRC-20)", icon: Wallet },
                { id: "USDT_ERC20", label: "USDT (ERC-20)", icon: CreditCard },
                { id: "BANK_WIRE", label: "Bank Wire", icon: Building },
                { id: "PAYPAL", label: "PayPal", icon: DollarSign },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id as any)}
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? "bg-[#133027] border-[#22d3a0] text-[#eef6f4] shadow-sm"
                        : "bg-[#0b1715] border-[#152e28] text-[#71928a] hover:bg-[#0e201c]"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mb-2 ${
                        isSelected ? "text-[#22d3a0]" : "text-[#54736b]"
                      }`}
                    />
                    <span className="text-xs font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input with presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#799990]">
                Amount
              </label>
              <span className="text-xs text-[#6e8e86]">
                Available: ${available.toFixed(2)}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#62847c]">
                $
              </span>
              <input
                type="number"
                step="any"
                min="1"
                max={available}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-[#0c1815] border border-[#18362f] focus:border-[#22d3a0] text-[#eef6f4] font-mono text-lg font-bold outline-none transition-colors"
                placeholder="100.00"
              />
            </div>

            {/* Quick amount chips */}
            <div className="flex items-center gap-2 mt-2.5">
              {[50, 100, 250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toString())}
                  className="px-3 py-1 rounded-lg bg-[#0e1f1b] border border-[#17382f] text-xs font-mono text-[#789d93] hover:text-[#22d3a0] hover:border-[#235848] transition-colors"
                >
                  ${amt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(available.toString())}
                className="px-3 py-1 rounded-lg bg-[#143329] border border-[#235c4b] text-xs font-mono font-bold text-[#22d3a0] hover:bg-[#1a4034] transition-colors"
              >
                Max (${available.toFixed(2)})
              </button>
            </div>
          </div>

          {/* Payment Details Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#799990] mb-2">
              Payment details
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={getDestinationPlaceholder()}
              className="w-full px-4 py-3 rounded-xl bg-[#0c1815] border border-[#18362f] focus:border-[#22d3a0] text-[#eef6f4] font-mono text-sm outline-none transition-colors"
            />
            <p className="text-[11px] text-[#55756d] mt-1.5">
              Enter your recipient wallet address or bank credentials. Recorded exclusively in the local prototype sandbox.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#2b1417] border border-[#5c242b] text-xs text-[#ff7884] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button matching prompt: [ SUBMIT REQUEST ] */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-[#179672] to-[#22d3a0] hover:from-[#1bb288] hover:to-[#38e8b6] text-[#051a14] font-black text-sm uppercase tracking-wider transition-all transform active:scale-[0.99] shadow-lg shadow-[#22d3a0]/20"
          >
            [ SUBMIT REQUEST ]
          </button>
        </form>
      </div>

      {/* Withdrawal Request History Table */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] shadow-xl overflow-hidden">
        <div className="p-5 border-b border-[#16332c] flex items-center justify-between bg-[#0c1a17]">
          <div>
            <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#22d3a0]" />
              Withdrawal Request Records
            </h3>
            <p className="text-xs text-[#6e8e86] mt-0.5">
              Simulation audit trail & status management
            </p>
          </div>
          <span className="text-xs text-[#6e8e86] font-mono">
            {withdrawalRequests.length} recorded
          </span>
        </div>

        {withdrawalRequests.length === 0 ? (
          <div className="p-8 text-center text-[#6e8e86]">
            <p className="text-sm">No withdrawal requests recorded yet.</p>
            <p className="text-xs text-[#52746b] mt-1">
              Submit a request using the form above to see how the platform handles payouts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b1715] text-[#6b8b83] font-bold border-b border-[#16332c]">
                <tr>
                  <th className="p-3.5 pl-5">REQUEST ID</th>
                  <th className="p-3.5">DATE / TIME</th>
                  <th className="p-3.5">METHOD</th>
                  <th className="p-3.5">DESTINATION</th>
                  <th className="p-3.5">AMOUNT</th>
                  <th className="p-3.5">STATUS</th>
                  <th className="p-3.5 pr-5 text-right">SIMULATE ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152e28]">
                {withdrawalRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#0c1a17]">
                    <td className="p-3.5 pl-5 font-mono font-bold text-[#eef6f4]">
                      {req.id}
                    </td>
                    <td className="p-3.5 text-[#72948c] font-mono">
                      {new Date(req.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="p-3.5 text-[#c6ded8]">{req.method}</td>
                    <td className="p-3.5 font-mono text-[#72948c] max-w-[150px] truncate">
                      {req.destination}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-[#22d3a0]">
                      ${req.amount.toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          req.status === "PENDING"
                            ? "bg-[#2b2413] text-[#fbbf24] border border-[#57441d]"
                            : req.status === "SIMULATED_APPROVED"
                            ? "bg-[#143b2b] text-[#22d3a0] border border-[#23634c]"
                            : "bg-[#2d171a] text-[#ff6470] border border-[#542127]"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right space-x-2">
                      {req.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => approveWithdrawal(req.id)}
                            className="px-2.5 py-1 rounded bg-[#133028] hover:bg-[#1a4438] text-[#22d3a0] font-semibold transition-colors"
                            title="Simulate Approval"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => cancelWithdrawal(req.id)}
                            className="px-2.5 py-1 rounded bg-[#2b1518] hover:bg-[#3b191e] text-[#ff6470] font-semibold transition-colors"
                            title="Cancel Request & Return Funds"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {req.status === "SIMULATED_APPROVED" && (
                        <span className="text-[10px] text-[#4ea892] font-semibold">
                          Completed (Simulated)
                        </span>
                      )}
                      {req.status === "CANCELLED" && (
                        <span className="text-[10px] text-[#6b8b83]">
                          Funds Restored
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
