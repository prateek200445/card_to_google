import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["stunning-runway-product.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.io"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "ngrok-skip-browser-warning", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
