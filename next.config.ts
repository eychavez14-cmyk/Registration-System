import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site root is the admin entrance (login when signed out); registrants use each event's /e/<link>.
  redirects: async () => [{ source: "/", destination: "/admin", permanent: false }],
  // Logos/banners from Supabase storage are resized to the size shown (WebP) by Vercel. Uploaded files never
  // change (each upload gets a new name), so the resized copies can be cached for a month.
  images: {
    remotePatterns: [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/**`)],
    minimumCacheTTL: 2678400,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
