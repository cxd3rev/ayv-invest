import type { NextConfig } from "next";

const pages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = pages
  ? {
      output: "export",
      basePath: "/ayv-invest",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      async rewrites() {
        return [
          {
            source: "/yahoo/:path*",
            destination: "https://query1.finance.yahoo.com/:path*",
          },
          {
            source: "/frankfurter/:path*",
            destination: "https://api.frankfurter.app/:path*",
          },
        ];
      },
    };

export default nextConfig;
