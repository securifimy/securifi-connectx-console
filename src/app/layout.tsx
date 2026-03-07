import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Securifi Connect | WhatsApp Inbox & API",
  description: "Multi-tenant WhatsApp inbox with API, webhooks, and team collaboration.",
  openGraph: {
    title: "Securifi Connect",
    description: "Multi-tenant WhatsApp inbox with API, webhooks, and team collaboration.",
    url: "https://console.connect.securifi.com.my",
    siteName: "Securifi Connect",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Securifi Connect" }],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--border)]/40 bg-[var(--surface2)]">
      <div className="max-w-screen-xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text2)]">
        <div>© {year} Securifi. All rights reserved.</div>
        <div className="flex gap-4">
          <Link href="/pricing" className="hover:text-[var(--text)]">Pricing</Link>
          <Link href="/docs" className="hover:text-[var(--text)]">Docs</Link>
          <Link href="/contact" className="hover:text-[var(--text)]">Contact</Link>
          <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
          <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.className} min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex-1 min-h-0">{children}</div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
