import type { NextConfig } from "next";
// @ts-expect-error — next-pwa has no types
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["100.111.16.99", "ocsdev"],
  turbopack: {},
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig);
