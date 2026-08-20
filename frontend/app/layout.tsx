import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import PwaRegister from "@/components/PwaRegister";

export const viewport: Viewport = {
  themeColor: "#3366cc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "CardScan AI — Visiting Card Data Extractor",
  description:
    "Upload business cards and instantly extract structured contact data using OCR + AI. Export to Excel or Google Sheets.",
  keywords: ["business card scanner", "OCR", "contact extractor", "visiting card", "AI"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CardScan AI",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="relative z-10">
        <PwaRegister />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(0,0,0,0.08)",
              color: "#1a1a1a",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}

