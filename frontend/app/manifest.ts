import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CardScan AI",
    short_name: "CardScan AI",
    description: "Scan visiting cards and extract structured contacts instantly with OCR + AI.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfbf7",
    theme_color: "#3366cc",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
