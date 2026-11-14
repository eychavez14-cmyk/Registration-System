import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site root is the admin entrance (login when signed out); registrants use each event's /e/<link>.
  redirects: async () => [{ source: "/", destination: "/admin", permanent: false }],
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
