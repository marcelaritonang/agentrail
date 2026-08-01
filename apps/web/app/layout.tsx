import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { IconProvider } from "../components/icon-provider";
import { readPublicAgentRailConfig } from "../lib/public-config";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const publicConfig = readPublicAgentRailConfig();
const siteDescription =
  "Local-first context and forensic evidence for developers building with AI agents.";

export const metadata: Metadata = {
  metadataBase: publicConfig.siteUrl,
  title: { default: "AgentRail", template: "%s | AgentRail" },
  description: siteDescription,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "AgentRail",
    title: "AgentRail",
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "AgentRail forensic recorder for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentRail",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${jetBrainsMono.variable}`}
    >
      <body>
        <IconProvider>{children}</IconProvider>
      </body>
    </html>
  );
}
