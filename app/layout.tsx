import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { SessionProvider } from "@/components/providers/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hamees Attire - Bespoke Tailoring & Wedding Attire | Amritsar",
  description: "Premium bespoke tailoring and wedding attire specialists in Amritsar. Expert sherwani designers and custom tailoring for men and women. Contact: +91-8400008096",
  keywords: ["bespoke tailoring", "sherwani", "wedding attire", "custom tailoring", "Amritsar", "Hamees Attire", "groom wear", "wedding suits"],
  authors: [{ name: "Hamees Attire" }],
  openGraph: {
    title: "Hamees Attire - Bespoke Tailoring & Wedding Attire",
    description: "Premium bespoke tailoring and wedding attire specialists in Amritsar",
    url: "https://hamees.gagneet.com",
    siteName: "Hamees Attire",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hamees Attire - Bespoke Tailoring",
    description: "Premium wedding attire and bespoke tailoring in Amritsar",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.svg",
  },
};

// Viewport should be exported separately in Next.js 16+
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </SessionProvider>
      </body>
    </html>
  );
}
