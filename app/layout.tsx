import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/app/lib/config/brand";
import { Toaster } from "@/app/components/toast";
import { ServiceWorkerRegistration } from "@/app/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  applicationName: BRAND.appName,
  title: BRAND.appName,
  description: BRAND.description,
  appleWebApp: {
    capable: true,
    title: BRAND.appName,
    statusBarStyle: "default"
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#4f46e5"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegistration />
        <Toaster />
      </body>
    </html>
  );
}
