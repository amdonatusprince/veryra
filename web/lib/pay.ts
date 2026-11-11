export function parsePayCode(
  value: string,
): { receiver: string; amount: string } | null {
  const match = value
    .trim()
    .match(/^veyra:pay:([^:\s]+):([0-9]+(?:\.[0-9]+)?)$/);
  if (!match) return null;
  return { receiver: match[1], amount: match[2] };
}

export function payCode(receiver: string, amount: string) {
  return `veyra:pay:${receiver}:${amount}`;
}
