import { existsSync, readFileSync } from "fs";
import type { NextConfig } from "next";
import path from "path";

function loadRootEnv() {
  const file = path.join(__dirname, "..", ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const split = trimmed.indexOf("=");
    if (split === -1) continue;
    const key = trimmed.slice(0, split).trim();
    const value = trimmed.slice(split + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadRootEnv();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_NEAR_NETWORK_ID: process.env.NEAR_NETWORK_ID ?? "testnet",
    NEXT_PUBLIC_NEAR_NODE_URL:
      process.env.NEAR_NODE_URL ?? "https://test.rpc.fastnear.com",
    NEXT_PUBLIC_CONTRACT_ID: process.env.NEAR_CONTRACT_ID ?? "",
    NEXT_PUBLIC_USDC_TOKEN: process.env.NEAR_USDC_TOKEN ?? "",
  },
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
