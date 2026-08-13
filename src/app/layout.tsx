import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { OneSignalProvider } from "@/components/mychurch/shared/onesignal-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MYCHURCH - Gestion d'Église Moderne",
  description:
    "Plateforme professionnelle de gestion d'église. Remplacez les cahiers papier, registres physiques et fichiers Excel par une solution moderne et sécurisée.",
  manifest: '/manifest.json',
  icons: {
    icon: '/logo-mychurch.png',
    apple: '/logo-mychurch.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'MYCHURCH',
    'theme-color': '#1e40af',
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark">
      <head>
        <link rel="apple-touch-icon" href="/logo-mychurch.png" />
        <Script src="/register-sw.js" strategy="afterInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="professional"
          enableSystem={false}
          themes={["light", "dark", "professional"]}
        >
          <OneSignalProvider>
            {children}
            <Toaster />
          </OneSignalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}