import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3000/api/:path*",
      },
      {
        source: "/cable",
        destination: "http://127.0.0.1:3000/cable",
      },
      {
        source: "/cable/:path*",
        destination: "http://127.0.0.1:3000/cable/:path*",
      },
    ];
  },
};

export default nextConfig;
