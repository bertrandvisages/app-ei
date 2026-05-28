import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // sharp embarque des binaires libvips natifs platform-specific
  // (@img/sharp-libvips-linuxmusl-* en prod Alpine). On le laisse hors du
  // bundle webpack pour que Next.js le trace correctement vers .next/standalone.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
