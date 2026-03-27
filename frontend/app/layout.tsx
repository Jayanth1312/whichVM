import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://whichvm.com"),
  title: {
    template: "%s | WhichVM",
    default: "WhichVM | Compare Cloud VM Pricing & Specs",
  },
  description:
    "WhichVM is the fastest way to compare cloud providers and find the best VM for your workload. Compare AWS, Azure, and GCP instance pricing and specifications in seconds.",
  keywords: ["cloud", "vm", "compare", "aws", "azure", "gcp", "pricing", "specifications", "virtual machine"],
  authors: [{ name: "WhichVM" }],
  creator: "WhichVM",
  publisher: "WhichVM",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://whichvm.com",
    siteName: "WhichVM",
    title: "WhichVM | Compare Cloud VM Pricing & Specs",
    description: "Compare cloud providers and find the best VM for your workload.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WhichVM - Compare Cloud VM Pricing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhichVM | Compare Cloud VM Pricing & Specs",
    description: "Compare cloud providers and find the best VM for your workload.",
    images: ["/og-image.png"],
    creator: "@whichvm",
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
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || "",
    other: {
      "msvalidate.01": process.env.BING_SITE_VERIFICATION || "",
    },
  },
};

import { ScrollbarHandler } from "@/components/scrollbar-handler";
import { Header } from "@/components/ui/header";
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider defaultTheme="dark" storageKey="whichvm-theme">
          <TooltipProvider>
            <ScrollbarHandler />
            <Header />
            {children}
            <Analytics />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
