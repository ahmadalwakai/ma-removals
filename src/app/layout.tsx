import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { EmotionRegistry } from "@/components/providers/EmotionRegistry";
import { ClientShell } from "@/components/layout/ClientShell";
import { SITE } from "@/lib/constants";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_DESCRIPTION =
  "MA Removals — house moves, office relocations, and furniture deliveries across Glasgow, Edinburgh, and Dundee. Fixed prices, fully insured, book online in minutes.";

const OG_IMAGE = {
  url: "/images/hero/hero-01.jpg",
  width: 1200,
  height: 630,
  alt: `${SITE.name} — ${SITE.tagline}`,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE.name,
  referrer: "origin-when-cross-origin",
  keywords: [
    "removals Glasgow",
    "removals Edinburgh",
    "removals Dundee",
    "house move Scotland",
    "van with man Glasgow",
    "man and van Edinburgh",
    "furniture removals Scotland",
    "office removals Glasgow",
    "piano movers Scotland",
    "packing service Glasgow",
    "MA Removals",
    "maremovals",
  ],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "Removals & Moving Services",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: SITE.url,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-GB"
      className={`${plusJakartaSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <EmotionRegistry>
          <ThemeProvider>
            <ClientShell>{children}</ClientShell>
          </ThemeProvider>
        </EmotionRegistry>
      </body>
    </html>
  );
}
