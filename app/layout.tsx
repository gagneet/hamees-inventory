import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { getAppSettings } from "@/lib/settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Reduces preload warning
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap", // Reduces preload warning
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Branding comes from Admin Settings → Business (BusinessSettings), not from code
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  const place = [settings.city, settings.country].filter(Boolean).join(", ");
  const description =
    settings.tagline ||
    `Inventory, orders and production management for ${settings.businessName}${place ? `, ${place}` : ""}`;

  return {
    title: { default: settings.businessName, template: `%s | ${settings.businessName}` },
    description,
    applicationName: settings.businessName,
    authors: [{ name: settings.businessName }],
    // Internal business application — keep it out of search indexes
    robots: { index: false, follow: false },
    openGraph: {
      title: settings.businessName,
      description,
      siteName: settings.businessName,
      locale: settings.locale.replace("-", "_"),
      type: "website",
    },
    icons: {
      icon: "/favicon.svg",
      apple: "/apple-touch-icon.svg",
    },
  };
}

// Viewport should be exported separately in Next.js 16+
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getAppSettings();
  return (
    <html lang={settings.locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} antialiased`}
      >
        <SessionProvider>
          {children}
          <SonnerToaster position="top-center" richColors />
        </SessionProvider>
      </body>
    </html>
  );
}
