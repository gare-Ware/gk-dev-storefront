import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Storefront API returns product images on Shopify's CDN; next/image
    // rejects any remote host that isn't allowlisted here.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
