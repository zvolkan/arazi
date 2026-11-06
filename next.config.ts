import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "exceljs"],
  // PDF oluşturan fonksiyon yazı tiplerini ve logoyu Vercel'de de bulabilsin
  outputFileTracingIncludes: {
    "/api/recete/[id]": ["./fonts/**/*", "./public/brand/**/*"],
  },
};

export default nextConfig;
