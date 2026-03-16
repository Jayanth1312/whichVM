import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WhichVM",
  description:
    "Compare cloud providers and find the best VM for your workload.",
};

import { ScrollbarHandler } from "@/components/scrollbar-handler";
import { Header } from "@/components/ui/header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="antialiased bg-black text-white">
        <TooltipProvider>
          <ScrollbarHandler />
          <Header />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
