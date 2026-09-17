import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader, Silkscreen } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const silkscreen = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-silkscreen" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: { default: "Go Forge", template: "%s · Go Forge" },
  description: "Learn Go from first principles by predicting, failing, and decoding. Plus a graded system design canvas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${jetbrains.variable} ${newsreader.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
