"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthInstance } from "./firebase";

/**
 * React binding for Firebase Auth state. Safe under SSR: the listener is
 * only attached in a client effect, so the server always renders
 * { user: null, loading: true }.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const auth = getAuthInstance();
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}
