"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { clientConfigError, getAuthInstance } from "./firebase";
import { friendlyAuthError } from "./authActions";

/**
 * React binding for Firebase Auth state.
 *
 * Safe under SSR: the listener is only attached in a client effect, and every
 * value used for the first render derives from build-time configuration, so the
 * server and the browser agree (no hydration mismatch, no navigation before the
 * auth state is known).
 *
 * `loading` always resolves. An unusable Firebase configuration, a blocked
 * storage layer, or a failing auth listener is reported through `error` instead
 * of leaving the workspace stuck on "Connecting…" forever.
 */
export function useAuth() {
  // Pure function of build-time environment variables: identical on server and
  // client, so it is safe to read during render.
  const configProblem = clientConfigError();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!configProblem);
  const [error, setError] = useState(configProblem ?? "");

  useEffect(() => {
    if (typeof window === "undefined" || configProblem) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onAuthStateChanged(
        getAuthInstance(),
        (next) => {
          if (!active) return;
          setUser(next);
          setError("");
          setLoading(false);
        },
        (failure) => {
          if (!active) return;
          setError(friendlyAuthError(failure));
          setLoading(false);
        },
      );
    } catch (failure) {
      // getAuth() throws synchronously on an invalid configuration.
      const message = friendlyAuthError(failure);
      queueMicrotask(() => {
        if (!active) return;
        setError(message);
        setLoading(false);
      });
      return;
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [configProblem]);

  return { user, loading, error };
}
