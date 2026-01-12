import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
        {children}
      </body>
    </html>
  );
}
