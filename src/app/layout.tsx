import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: "NEXUS AI — Your intelligent trading workspace",
  description:
    "A transparent, Firebase-backed autonomous trading simulation. Virtual funds. Auditable decisions. No real-money risk.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
