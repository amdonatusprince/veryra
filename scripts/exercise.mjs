import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, keyStores, KeyPair } from "near-api-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyFile = path.join(root, ".keys", "accounts.json");
const wasmPath = path.join(root, "contract/target/wasm32-unknown-unknown/release/veyra.wasm");
const tokenWasmPath = path.join(root, "token/target/wasm32-unknown-unknown/release/veyra_usdc.wasm");
const envFile = path.join(root, ".env");
const networkId = "testnet";
const nodeUrl = process.env.NEAR_NODE_URL || "https://test.rpc.fastnear.com";
const YOCTO = 10n ** 24n;
const STORAGE = YOCTO / 10n;
const GAS = 100_000_000_000_000n;
const MINT_GAS = 300_000_000_000_000n;

const PASS_IMAGE = "https://example.com/veyra-pass.png";
const tiers = [
  { id: "silver", name: "Member", xp_threshold: 0, revenue_share_bps: 0, access_rights: ["events"] },
  { id: "gold", name: "Gold", xp_threshold: 100, revenue_share_bps: 1000, access_rights: ["events", "dinner", "cellar"] },
];

function yocto(whole, fraction = 0n) {
  return whole * YOCTO + fraction;
}

function loadEnv() {
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const split = trimmed.indexOf("=");
    if (split === -1) continue;
    const key = trimmed.slice(0, split).trim();
    const value = trimmed.slice(split + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function writeEnv(contractId, ownerId, tokenId) {
  const current = existsSync(envFile) ? readFileSync(envFile, "utf8") : readFileSync(path.join(root, ".env.example"), "utf8");
  let next = current
    .replace(/^NEAR_CONTRACT_ID=.*$/m, `NEAR_CONTRACT_ID=${contractId}`)
    .replace(/^NEAR_PROTOCOL_OWNER=.*$/m, `NEAR_PROTOCOL_OWNER=${ownerId}`);
  if (/^NEAR_USDC_TOKEN=.*$/m.test(next)) next = next.replace(/^NEAR_USDC_TOKEN=.*$/m, `NEAR_USDC_TOKEN=${tokenId}`);
  else next = `${next.trimEnd()}\nNEAR_USDC_TOKEN=${tokenId}\n`;
  writeFileSync(envFile, next.endsWith("\n") ? next : `${next}\n`);
}

async function createAccount(prefix) {
  const keyPair = KeyPair.fromRandom("ed25519");
  const accountId = `${prefix}-${Date.now().toString(36)}.testnet`;
  const response = await fetch("https://helper.testnet.near.org/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      newAccountId: accountId,
      newAccountPublicKey: keyPair.getPublicKey().toString(),
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Could not create ${accountId}: ${text}`);
  return { accountId, secretKey: keyPair.toString() };
}

function returned(outcome) {
  const receipts = outcome.receipts_outcome ?? [];
  for (let index = receipts.length - 1; index >= 0; index -= 1) {
    const status = receipts[index].outcome?.status;
    if (status?.SuccessValue) {
      const text = Buffer.from(status.SuccessValue, "base64").toString();
      return text ? JSON.parse(text) : null;
    }
  }
  return null;
}

async function call(signer, contractId, methodName, args, deposit = 0n, gas = GAS) {
  const outcome = await signer.functionCall({
    contractId,
    methodName,
    args,
    gas,
    attachedDeposit: deposit,
  });
  return returned(outcome);
}

async function view(signer, contractId, methodName, args = {}) {
  return signer.viewFunction({ contractId, methodName, args });
}

async function viewUntil(signer, contractId, methodName, args, ready) {
  let last;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    last = await view(signer, contractId, methodName, args);
    if (ready(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return last;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectPanic(work, expected) {
  try {
    await work();
  } catch (caught) {
    const text = caught instanceof Error ? caught.message : String(caught);
    assert(text.includes(expected), `Expected "${expected}" but got: ${text}`);
    return;
  }
  throw new Error(`Expected a panic containing "${expected}"`);
}

loadEnv();
if (!existsSync(wasmPath)) throw new Error(`Build the wasm first: ${wasmPath}`);

mkdirSync(path.dirname(keyFile), { recursive: true });
let keys = existsSync(keyFile) ? JSON.parse(readFileSync(keyFile, "utf8")) : null;
if (!keys?.contract || !keys?.alice || !keys?.bob) {
  console.log("Creating testnet accounts…");
  const contract = await createAccount("veyra");
  const alice = await createAccount("veyraalice");
  const bob = await createAccount("veyrabob");
  keys = { contract, alice, bob };
  writeFileSync(keyFile, JSON.stringify(keys, null, 2));
  console.log(`Contract account ${contract.accountId}`);
}
if (!keys.usdc) {
  console.log("Creating the mock USDC account…");
  keys.usdc = await createAccount("veyrausdc");
  writeFileSync(keyFile, JSON.stringify(keys, null, 2));
}

const keyStore = new keyStores.InMemoryKeyStore();
for (const record of [keys.contract, keys.alice, keys.bob, keys.usdc]) {
  await keyStore.setKey(networkId, record.accountId, KeyPair.fromString(record.secretKey));
}
const near = await connect({ networkId, nodeUrl, keyStore });
const contractAccount = await near.account(keys.contract.accountId);
const alice = await near.account(keys.alice.accountId);
const bob = await near.account(keys.bob.accountId);
const contractId = keys.contract.accountId;
const tokenAccount = await near.account(keys.usdc.accountId);
const usdcId = keys.usdc.accountId;

console.log(`Deploying mock USDC to ${usdcId}…`);
await tokenAccount.deployContract(new Uint8Array(readFileSync(tokenWasmPath)));
const tokenReady = await view(tokenAccount, usdcId, "ft_metadata").catch(() => null);
if (!tokenReady) {
  await call(tokenAccount, usdcId, "new", { owner_id: usdcId }, 0n, MINT_GAS);
}
const storageDeposit = 1_250_000_000_000_000_000_000n;
for (const accountId of [contractId, keys.alice.accountId, keys.bob.accountId, usdcId]) {
  const registered = await view(tokenAccount, usdcId, "storage_balance_of", { account_id: accountId });
  if (!registered) await call(tokenAccount, usdcId, "storage_deposit", { account_id: accountId, registration_only: true }, storageDeposit);
}
await call(tokenAccount, usdcId, "faucet", { account_id: keys.alice.accountId }).catch(() => undefined);

console.log(`Deploying wasm to ${contractId}…`);
await contractAccount.deployContract(new Uint8Array(readFileSync(wasmPath)));
const initialized = await view(contractAccount, contractId, "get_protocol_owner").catch(() => null);
if (!initialized) {
  await call(contractAccount, contractId, "new_default_meta", { owner_id: contractId }, 0n, MINT_GAS);
}

await call(contractAccount, contractId, "set_usdc_token", { token_id: usdcId });
writeEnv(contractId, contractId, usdcId);

const suffix = Date.now().toString(36).slice(-6);
const programId = `harbour${suffix}`;
console.log(`Exercising ${contractId} with programme ${programId}`);

await call(
  contractAccount,
  contractId,
  "create_program",
  { program_id: programId, name: "Harbour", symbol: "HRB", tiers },
  STORAGE,
  MINT_GAS,
);
await call(contractAccount, contractId, "update_program", { program_id: programId, name: "Harbour Club", symbol: "HRBR" });
await call(
  contractAccount,
  contractId,
  "configure_tiers",
  {
    program_id: programId,
    tiers: [
      { ...tiers[0], name: "Member" },
      { ...tiers[1], access_rights: ["events", "dinner", "cellar"] },
    ],
  },
  STORAGE,
  MINT_GAS,
);
const pictured = await call(
  contractAccount,
  contractId,
  "set_program_media",
  { program_id: programId, media: PASS_IMAGE },
  STORAGE,
  MINT_GAS,
);
assert(pictured.media === PASS_IMAGE, "Programme image was not stored");
await expectPanic(
  () => call(contractAccount, contractId, "set_program_media", { program_id: programId, media: "http://example.com/pass.png" }, STORAGE),
  "Image address must start with https://",
);

const issued = await call(
  contractAccount,
  contractId,
  "issue_membership",
  { program_id: programId, receiver_id: keys.alice.accountId, tier_id: null, title: "Gold card", description: null },
  STORAGE,
  MINT_GAS,
);
assert(issued.token_id === "m1" || issued.bound_account?.endsWith(`.${contractId}`), "Issue did not bind an account");
assert(issued.media === PASS_IMAGE, "Issued pass is missing the programme image");
const found = await view(contractAccount, contractId, "find_membership", { query: issued.bound_account });
assert(found?.token_id === issued.token_id, "Pass address did not resolve");
const tokenId = issued.token_id;
await call(contractAccount, contractId, "bind_account", { token_id: tokenId });

const second = await call(
  contractAccount,
  contractId,
  "issue_membership",
  { program_id: programId, receiver_id: keys.bob.accountId, tier_id: "silver", title: null, description: null },
  STORAGE,
  MINT_GAS,
);

await call(contractAccount, contractId, "fund_membership", { token_id: tokenId }, yocto(1n));
await call(
  alice,
  usdcId,
  "ft_transfer_call",
  { receiver_id: contractId, amount: "10000000", memo: null, msg: `vault:${tokenId}` },
  1n,
  MINT_GAS,
);
const paid = await call(
  alice,
  contractId,
  "pay",
  { token_id: tokenId, receiver_id: keys.bob.accountId, amount: "1000000" },
  1n,
);
assert(BigInt(paid.usdc_vault) === 9_000_000n, `Pay did not debit the pass: ${paid.usdc_vault}`);
await call(contractAccount, contractId, "fund_rewards", { program_id: programId }, yocto(1n) / 2n);
const awarded = await call(contractAccount, contractId, "award_points", { token_id: tokenId, points: 100, memo: "dinner" });
assert(awarded.tier_id === "gold", `Expected gold, got ${awarded.tier_id}`);

const gifted = await call(alice, contractId, "gift_points", {
  from_token_id: tokenId,
  to_token_id: second.token_id,
  points: 20,
  memo: "welcome",
});
assert(gifted.points === 80 && gifted.xp === 100, "Gift should move points and keep XP");
const revoked = await call(contractAccount, contractId, "revoke_points", { token_id: second.token_id, points: 5, memo: "adjustment" });
assert(revoked.points === 15, `Expected 15 points, got ${revoked.points}`);

await call(contractAccount, contractId, "distribute_reward", { program_id: programId, token_id: tokenId, amount: (yocto(1n) / 5n).toString() });
await call(contractAccount, contractId, "record_revenue", { program_id: programId }, yocto(1n));
const shared = await call(contractAccount, contractId, "distribute_revenue", { program_id: programId });
assert(BigInt(shared.revenue_pool) < yocto(1n), "Revenue was not distributed");

const dinner = await view(contractAccount, contractId, "verify_membership", { owner_id: keys.alice.accountId, program_id: programId, right: "dinner" });
const cellar = await view(contractAccount, contractId, "check_access", { token_id: tokenId, right: "cellar" });
const rights = await view(contractAccount, contractId, "get_access_rights", { token_id: tokenId });
assert(dinner === true && cellar === true && rights.length === 3, "Access checks did not match Gold");

await call(alice, contractId, "nft_approve", { token_id: tokenId, account_id: keys.bob.accountId }, yocto(1n) / 10n);
const approved = await view(contractAccount, contractId, "nft_is_approved", { token_id: tokenId, approved_account_id: keys.bob.accountId, approval_id: 1 });
assert(approved === true, "Approval was not recorded");
await call(alice, contractId, "nft_revoke", { token_id: tokenId, account_id: keys.bob.accountId }, 1n);
await call(alice, contractId, "nft_approve", { token_id: tokenId, account_id: keys.bob.accountId }, yocto(1n) / 10n);
await call(alice, contractId, "nft_revoke_all", { token_id: tokenId }, 1n);

const paused = await call(contractAccount, contractId, "pause_program", { program_id: programId });
assert(paused.paused === true, "Programme did not pause");
const closed = await view(contractAccount, contractId, "check_access", { token_id: tokenId, right: "dinner" });
assert(closed === false, "Paused programme should fail closed");
await expectPanic(
  () => call(contractAccount, contractId, "award_points", { token_id: tokenId, points: 1, memo: null }),
  "Programme is paused",
);
await call(contractAccount, contractId, "resume_program", { program_id: programId });

await expectPanic(
  () => call(alice, contractId, "award_points", { token_id: tokenId, points: 1, memo: null }),
  "Only the programme owner",
);

const accountView = await view(contractAccount, contractId, "get_account", { token_id: tokenId });
await call(alice, contractId, "transfer_membership", { receiver_id: keys.bob.accountId, token_id: tokenId, memo: "sale" }, 1n);
const moved = await viewUntil(
  contractAccount,
  contractId,
  "get_account",
  { token_id: tokenId },
  (account) => account.controller === keys.bob.accountId,
);
assert(moved.controller === keys.bob.accountId, `Transfer did not move the controller: ${JSON.stringify(moved)}`);
assert(moved.vault === accountView.vault, "Transfer changed the vault");
assert(moved.bound_account === accountView.bound_account, "Transfer changed the bound account");

await expectPanic(
  () => call(alice, contractId, "withdraw", { token_id: tokenId, amount: "1" }, 1n),
  "Only the current owner",
);
const withdrawn = await call(bob, contractId, "withdraw", { token_id: tokenId, amount: (yocto(1n) / 10n).toString() }, 1n);
assert(BigInt(withdrawn.vault) < BigInt(moved.vault), "Withdraw did not reduce the vault");

const metadata = await view(contractAccount, contractId, "nft_metadata");
const owner = await view(contractAccount, contractId, "get_protocol_owner");
const accounting = await view(contractAccount, contractId, "get_accounting");
const history = await view(contractAccount, contractId, "get_membership_history", { token_id: tokenId });
const programHistory = await view(contractAccount, contractId, "get_program_history", { program_id: programId });
const listed = await view(contractAccount, contractId, "list_programs", { from_index: 0, limit: 50 });
const forOwner = await view(contractAccount, contractId, "memberships_for_owner", { account_id: keys.bob.accountId });
const forProgram = await view(contractAccount, contractId, "memberships_for_program", { program_id: programId });
const token = await view(contractAccount, contractId, "nft_token", { token_id: tokenId });
const supply = await view(contractAccount, contractId, "nft_total_supply");
const tokens = await view(contractAccount, contractId, "nft_tokens", { from_index: "0", limit: 10 });
const ownerSupply = await view(contractAccount, contractId, "nft_supply_for_owner", { account_id: keys.bob.accountId });

const kinds = history.map((item) => item.kind);
for (const kind of ["issued", "bound", "funded", "paid", "points_awarded", "tier_changed", "points_gifted", "reward_distributed", "revenue_distributed", "transferred", "withdrawn"]) {
  assert(kinds.includes(kind), `History missing ${kind}: ${kinds.join(", ")}`);
}

console.log(
  JSON.stringify(
    {
      contractId,
      programId,
      alice: keys.alice.accountId,
      bob: keys.bob.accountId,
      tokenId,
      boundAccount: moved.bound_account,
      vaultAfterWithdraw: withdrawn.vault,
      metadata: metadata.symbol,
      protocolOwner: owner,
      accounting,
      historyKinds: kinds,
      programEvents: programHistory.length,
      programmes: listed.length,
      bobMemberships: forOwner.length,
      programmeMemberships: forProgram.length,
      nftOwner: token.owner_id,
      supply,
      tokens: tokens.length,
      bobSupply: ownerSupply,
    },
    null,
    2,
  ),
);
