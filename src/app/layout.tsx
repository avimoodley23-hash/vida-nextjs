import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Vida — Your Life, Handled",
  description: "Your AI personal assistant. Reminders, habits, calendar, spending.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vida",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F5F0E8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="font-sans antialiased bg-vida-bg text-vida-text">
        <Providers>{children}</Providers>
        <SwRegister />
      </body>
    </html>
  );
}
