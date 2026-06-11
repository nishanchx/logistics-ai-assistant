import { Barlow_Condensed, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata = {
  title: "DispatchDesk — Logistics AI Assistant",
  description:
    "RAG-powered assistant for shipments, logistics SOPs, and HR policies.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} ${body.variable}`}>
        {children}
      </body>
    </html>
  );
}