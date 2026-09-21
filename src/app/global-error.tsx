"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary (it replaces the root layout, so it renders its own
 * <html>/<body>). A client-side exception can never leave the visitor with a
 * blank or browser-level "page couldn't load" screen again.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="error-boundary">
          <section className="panel account-required">
            <h2>This page stopped working</h2>
            <p>
              Your account data is stored in Firebase, not in the page, so a
              reload is safe.
            </p>
            <p className="helper">
              {error.message || "Unknown application error."}
              {error.digest ? ` (reference ${error.digest})` : ""}
            </p>
            <div className="session-actions">
              <button className="button primary" onClick={reset}>
                Try again
              </button>
              <button
                className="button secondary"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
