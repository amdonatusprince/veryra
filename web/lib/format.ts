const YOCTO = 10n ** 24n;
const USDC = 1_000_000n;

export function parseUsdc(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Enter a USDC amount, such as 10 or 0.50");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const padded = (fraction + "000000").slice(0, 6);
  return BigInt(whole) * USDC + BigInt(padded);
}

export function formatUsdc(amount: string | bigint): string {
  const value = typeof amount === "bigint" ? amount : BigInt(amount || "0");
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const cents = (abs + 5_000n) / 10_000n;
  const dollars = cents / 100n;
  const rest = (cents % 100n).toString().padStart(2, "0");
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${rest} USDC`;
}

export function parseNear(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,24})?$/.test(trimmed)) {
    throw new Error("Enter a NEAR amount, such as 10 or 0.5");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const padded = (fraction + "0".repeat(24)).slice(0, 24);
  return BigInt(whole) * YOCTO + BigInt(padded);
}

export function formatNear(yocto: string | bigint): string {
  const value = typeof yocto === "bigint" ? yocto : BigInt(yocto);
  const negative = value < 0n;
  const amount = negative ? -value : value;
  const whole = amount / YOCTO;
  const fraction = (amount % YOCTO)
    .toString()
    .padStart(24, "0")
    .replace(/0+$/, "");
  const text = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

export function formatPoints(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(
    value,
  );
}

export function shortAccount(account: string): string {
  if (account.length <= 22) return account;
  return `${account.slice(0, 10)}…${account.slice(-8)}`;
}
