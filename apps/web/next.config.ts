import type { NextConfig } from "next";

/**
 * Hosted deploys (Railway): when API_INTERNAL_URL is set, the browser calls
 * `/backend/*` on the web origin and Next proxies it to the Nest API. That
 * keeps the `cs_access` / `cs_refresh` cookies first-party, so `SameSite=Lax`
 * still works when web and API run on different hosts. Set
 * NEXT_PUBLIC_API_URL=/backend alongside it. Both are read at build time.
 *
 * Local dev leaves API_INTERNAL_URL unset and calls the API directly.
 */
const apiInternalUrl = process.env.API_INTERNAL_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiInternalUrl) return [];
    return [
      {
        source: "/backend/:path*",
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
