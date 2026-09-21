"use client";

import { useEffect } from "react";
import { ShieldCheck, RotateCw } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * Without it, any exception thrown while rendering the workspace (a malformed
 * Firestore document, an unexpected SDK state, a browser extension clash) tears
 * the whole React tree down and the browser is left with an empty, dead page —
 * which is exactly the "this page couldn't load" screen users reported after
 * signing in. The boundary keeps the failure visible, recoverable and honest.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace rendering failed", error);
  }, [error]);

  return (
    <main className="error-boundary">
      <section className="panel account-required">
        <ShieldCheck size={34} />
        <h2>The workspace hit an unexpected error</h2>
        <p>
          Your account and simulated funds are stored in Firestore, not in this
          page, so nothing is lost. Reload the workspace to continue.
        </p>
        <p className="helper">
          {error.message || "Unknown rendering error."}
          {error.digest ? ` (reference ${error.digest})` : ""}
        </p>
        <button className="button primary" onClick={reset}>
          <RotateCw size={16} />
          Reload workspace
        </button>
      </section>
    </main>
  );
}
