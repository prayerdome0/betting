"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, X, Waves } from "lucide-react";
import {
  friendlyAuthError,
  resetPassword,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/authActions";
import { useDialog } from "@/lib/useDialog";
import { isEmulator } from "@/lib/firebase";
export default function AuthDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setMessage(
          isEmulator
            ? "Reset link generated in the Firebase Auth emulator log. Local emulators do not send email."
            : "If an account exists, a password reset link has been sent. Check your inbox.",
        );
      } else {
        if (mode === "signup") await signUpWithEmail(email, password);
        else await signInWithEmail(email, password);
        onClose();
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="modal auth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close authentication"
        >
          <X size={19} />
        </button>
        <div className="auth-brand">
          <Waves size={28} />
        </div>
        <span className="eyebrow">YOUR NEXT CHAPTER IN TRADING</span>
        <h2 id="auth-title">
          {mode === "signup"
            ? "A smarter place to practice."
            : mode === "login"
              ? "Welcome back, trader."
              : "Let’s get you back in."}
        </h2>
        <p>
          {mode === "signup"
            ? "Create your simulation account. Start with $10 in virtual funds. Learn without risking real money."
            : mode === "login"
              ? "Your strategies, sessions, and simulated balance are right where you left them."
              : "Enter your account email to request a secure password reset."}
        </p>
        {mode !== "reset" && (
          <div className="segmented">
            <button
              className={mode === "signup" ? "selected" : ""}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Create account
            </button>
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              autoFocus
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== "reset" && (
            <label>
              Password
              <input
                type="password"
                minLength={mode === "signup" ? 8 : 1}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                placeholder={
                  mode === "signup" ? "At least 8 characters" : "Your password"
                }
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="alert success" role="status">
              {message}
            </div>
          )}
          <button disabled={busy} className="button primary wide" type="submit">
            {busy
              ? "Connecting securely…"
              : mode === "signup"
                ? "Create simulation account"
                : mode === "login"
                  ? "Sign in to your account"
                  : "Send reset link"}
            <ArrowRight size={16} />
          </button>
        </form>
        <button
          className="text-button auth-switch"
          onClick={() => {
            setMode(mode === "reset" ? "login" : "reset");
            setError("");
            setMessage("");
          }}
        >
          {mode === "reset" ? "Back to sign in" : "Forgot your password?"}
        </button>
        <div className="auth-foot">
          <LockKeyhole size={13} /> Secured by Firebase Authentication
        </div>
      </section>
    </div>
  );
}
