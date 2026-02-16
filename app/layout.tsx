import "leaflet/dist/leaflet.css";
import "./globals.css";
import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import AuthControls from "@/components/auth-controls";
import PwaRegister from "@/components/pwa-register";
import SessionRefresh from "@/components/session-refresh";
import { getServerSession } from "@/lib/auth-session";

const bodyFont = localFont({
  src: "./fonts/SFCompact.ttf",
  variable: "--font-body",
  display: "swap",
  fallback: ["Segoe UI", "sans-serif"]
});

const headingFont = localFont({
  src: "./fonts/NewYork.ttf",
  variable: "--font-heading",
  display: "swap",
  fallback: ["Georgia", "serif"]
});

export const metadata: Metadata = {
  title: "Car Tracking Dashboard",
  description: "Live fleet tracking and trip reporting",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" }]
  },
  appleWebApp: {
    capable: true,
    title: "Car Tracking Dashboard",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f766e"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const userLabel =
    session?.user.preferredUsername ?? session?.user.name ?? session?.user.email ?? null;

  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <PwaRegister />
        <SessionRefresh enabled={Boolean(session)} />
        <header className="topBar">
          <div className="topBarInner">
            <h1 className="brandTitle">Car Tracking Dashboard</h1>
            <div className="topBarActions">
              <nav className="topNav">
                <Link href="/">Fleet</Link>
                <Link href="/reports/trips">Trip Reports</Link>
              </nav>
              <AuthControls userLabel={userLabel} />
            </div>
          </div>
        </header>
        <main className="mainContent">{children}</main>
      </body>
    </html>
  );
}
