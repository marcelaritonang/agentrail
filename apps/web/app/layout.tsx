import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { IconProvider } from "../components/icon-provider";
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

export const metadata: Metadata = {
  title: { default: "AgentRail", template: "%s · AgentRail" },
  description: "Forensic traces, cost, and action evidence for AI agents.",
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
