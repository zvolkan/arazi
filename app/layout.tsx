import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arazi Takip Sistemi",
  description: "Çiftçi tarlası ziyaret takibi",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Arazi Takip", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2f6b3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden>🌱</span>
              Arazi Takip
            </Link>
            <Link href="/yeni" className="btn btn-light btn-sm">+ Yeni Kayıt</Link>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
