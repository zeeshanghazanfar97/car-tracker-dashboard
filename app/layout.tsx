import "leaflet/dist/leaflet.css";
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import AuthControls from "@/components/auth-controls";
import { getServerSession } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "Car Tracking Dashboard",
  description: "Live fleet tracking and trip reporting"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const userLabel =
    session?.user.preferredUsername ?? session?.user.name ?? session?.user.email ?? null;

  return (
    <html lang="en">
      <body>
        <header className="topBar">
          <div className="topBarInner">
            <h1>Car Tracking Dashboard</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <nav>
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
