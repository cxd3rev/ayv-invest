import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://cxd3rev.github.io/ayv-invest";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AYV Invest",
    template: "%s · AYV Invest",
  },
  description: "Personal investment portfolio tracker by AYV WRLD. Track stocks, ETFs, and crypto in euros.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "AYV Invest",
    description: "Personal investment portfolio tracker by AYV WRLD.",
    url: siteUrl,
    siteName: "AYV Invest",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
