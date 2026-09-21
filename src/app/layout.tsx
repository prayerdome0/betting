import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "X-Trader AI | Autonomous Trading Command Center",
  description:
    "A paper-first AI trading dashboard with deterministic signals, risk controls, market scanning, and auditable trade decisions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
