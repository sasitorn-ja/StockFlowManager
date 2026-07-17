import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sarabun",
});

export const metadata: Metadata = {
  title: "SB&M Inventory Management",
  description: "Inventory receive, issue, and expiry-priority stock management app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning className={sarabun.variable}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
