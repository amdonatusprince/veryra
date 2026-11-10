export const NETWORK = (process.env.NEXT_PUBLIC_NEAR_NETWORK_ID ||
  "testnet") as "testnet" | "mainnet";
export const RPC_URL =
  process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID?.trim() || "";
export const USDC_TOKEN = process.env.NEXT_PUBLIC_USDC_TOKEN?.trim() || "";

export const GAS = "100000000000000";
export const MINT_GAS = "300000000000000";
/** 0.1 NEAR. The contract refunds whatever storage does not use. */
export const STORAGE_DEPOSIT = "100000000000000000000000";
export const ONE_YOCTO = "1";
