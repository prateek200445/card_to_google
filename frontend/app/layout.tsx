import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "CardScan AI — Visiting Card Data Extractor",
  description:
    "Upload business cards and instantly extract structured contact data using OCR + AI. Export to Excel or Google Sheets.",
  keywords: ["business card scanner", "OCR", "contact extractor", "visiting card", "AI"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="relative z-10">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(15,15,25,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}
