import type { NextConfig } from "next";
const config: NextConfig = {
  env: {
    BAGDAR_DEFAULT_BACKEND:
      process.env.NETLIFY === "true" ? "netlify" : "sqlite",
    BAGDAR_DEFAULT_MODE: process.env.NETLIFY === "true" ? "demo" : "",
  },
  outputFileTracingIncludes: { "/api/*": ["./public/fonts/Report.ttf"] },
  serverExternalPackages: ["@pdf-lib/fontkit"],
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
