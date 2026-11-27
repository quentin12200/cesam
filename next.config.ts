import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.CESAM_LAB_TEST_ONLY === "1" ? {devIndicators:false as const, onDemandEntries:{maxInactiveAge:600000,pagesBufferLength:10}} : {}),
  serverExternalPackages: ["firebase-admin", "nodemailer"],
};

export default nextConfig;
