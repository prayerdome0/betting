import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xacheus Betting | Real Odds Sportsbook & Casino",
  description:
    "Xacheus Betting — real bookmaker odds via The Odds API, instant casino games, sounds, and live settlement. Demo platform: 18+, play responsibly.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
