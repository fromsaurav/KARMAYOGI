import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WebSocketProvider } from "@/components/features/WebSocketProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { HydrationProvider } from "@/components/providers/HydrationProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "KarmaYogi - Distributed Task Queue System",
  description: "Professional distributed task queue system for enterprise workflows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="module"
          src="https://unpkg.com/@splinetool/viewer@1.12.6/build/spline-viewer.js"
          async
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <HydrationProvider>
          <ThemeProvider>
            <WebSocketProvider>
              {children}
            </WebSocketProvider>
          </ThemeProvider>
        </HydrationProvider>
      </body>
    </html>
  );
}
