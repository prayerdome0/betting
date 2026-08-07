"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import sfx from "@/lib/sound";
import { friendlyAuthError, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/authActions";

type Mode = "signin" | "signup";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") await signInWithEmail(email.trim(), password);
      else await signUpWithEmail(email.trim(), password);
      sfx.win();
      onClose();
    } catch (err) {
      sfx.error();
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      sfx.win();
      onClose();
    } catch (err) {
      sfx.error();
      setError(friendlyAuthError(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-pop w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#0e1526] p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-white">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-xs font-bold text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-[#070b16] p-1">
          {([
            ["signin", "SIGN IN"],
            ["signup", "SIGN UP"],
          ] as [Mode, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                sfx.click();
                setMode(id);
                setError(null);
              }}
              className={`rounded-lg py-2 text-[11px] font-black transition ${mode === id ? "bg-cyan-300 text-slate-950 shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-[10px] font-black tracking-[0.14em] text-slate-500">EMAIL</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-white/[0.1] bg-[#070b16] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-300/50"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-[10px] font-black tracking-[0.14em] text-slate-500">PASSWORD</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-xl border border-white/[0.1] bg-[#070b16] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-300/50"
            />
          </div>

          {error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-3 py-2 text-[11px] font-semibold leading-4 text-rose-200">{error}</p>}

          <button
            onClick={() => void submit()}
            disabled={busy || googleBusy}
            className="bet-btn w-full rounded-xl px-4 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "PLEASE WAIT…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[9px] font-black tracking-[0.2em] text-slate-600">OR</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <button
            onClick={() => void google()}
            disabled={busy || googleBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            <GoogleGlyph />
            {googleBusy ? "CONTACTING GOOGLE…" : "CONTINUE WITH GOOGLE"}
          </button>

          <p className="text-center text-[10px] leading-4 text-slate-600">
            Your balance, bets and deposit history sync to your account and follow you across devices.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
