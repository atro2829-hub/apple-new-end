import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/context/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1B7A3D" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://applenet.app"),
  title: "Apple.NET - Hotspot Management | Apple.NET - إدارة الهوت سبوت",
  description: "Professional hotspot management platform - شراء كروت إنترنت وإدارة رصيدك بسهولة وأمان | Buy internet cards and manage your balance with ease and security",
  manifest: "/manifest.json",
  applicationName: "Apple.NET",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Apple.NET",
  },
  openGraph: {
    title: "Apple.NET - Hotspot Management | Apple.NET - إدارة الهوت سبوت",
    description: "Professional hotspot management platform | تطبيق إدارة الهوت سبوت الاحترافي",
    siteName: "Apple.NET",
    locale: "ar_YE",
    type: "website",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "Apple.NET",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Apple.NET - Hotspot Management | Apple.NET - إدارة الهوت سبوت",
    description: "Professional hotspot management platform",
    images: ["/icons/icon-512x512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Apple.NET" />
        <meta name="application-name" content="Apple.NET" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="msapplication-TileColor" content="#1B7A3D" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(registration) {
                      console.log('[App] SW registered:', registration.scope);
                      registration.update();
                    })
                    .catch(function(err) {
                      console.warn('[App] SW registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors duration-200`}
      >
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  borderRadius: "16px",
                  fontSize: "13px",
                },
              }}
            />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
