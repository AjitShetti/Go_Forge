import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], style: ["normal", "italic"], axes: ["wdth"], variable: "--font-archivo" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

const DESCRIPTION =
  "Learn Go from first principles. Every lesson starts with a Go program you will predict wrong — then you run it, see what really happened, and decode why, with real Go compiled in your browser. Written for Python and JavaScript developers.";

export const metadata: Metadata = {
  // Lets every route below give `alternates.canonical` and OG urls as a path.
  metadataBase: new URL(SITE_URL),
  title: { default: "Go Forge — learn Go from first principles", template: "%s · Go Forge" },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
    title: "Go Forge — learn Go from first principles",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Go Forge — learn Go from first principles", description: DESCRIPTION },
};

/** Tints the browser's own chrome with the page's ground colour, so the frame around
 *  the site is the same near-black the site is drawn on. */
export const viewport: Viewport = {
  themeColor: "#0c0d0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
