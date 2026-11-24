import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "pg" e "bcryptjs" rodam só no servidor.
  serverExternalPackages: ["pg"],
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
