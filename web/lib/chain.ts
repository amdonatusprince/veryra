import { CONTRACT_ID, RPC_URL } from "@/lib/config";

export type Tier = {
  id: string;
  name: string;
  xp_threshold: number;
  revenue_share_bps: number;
  access_rights: string[];
};

export type ProgramView = {
  id: string;
  owner_id: string;
  name: string;
  symbol: string;
  paused: boolean;
  tiers: Tier[];
  tier_counts: Record<string, number>;
  reward_pool: string;
  revenue_pool: string;
  membership_count: number;
  media: string | null;
  color: string | null;
  usdc_reward_pool: string;
  usdc_revenue_pool: string;
};

export type MembershipView = {
  token_id: string;
  program_id: string;
  program_name: string;
  owner_id: string;
  tier_id: string;
  tier_name: string;
  xp: number;
  points: number;
  xp_to_next: number | null;
  bound_account: string;
  vault: string;
  access_rights: string[];
  paused: boolean;
  media: string | null;
  color: string | null;
  usdc_vault: string;
};

export type Activity = {
  kind: string;
  actor: string;
  at: number;
  amount: string | null;
  memo: string | null;
  counterpart: string | null;
  detail: string | null;
};

export type Accounting = {
  programmes: number;
  memberships: number;
  reward_pool: string;
  revenue_pool: string;
  vaults: string;
  usdc_reward_pool: string;
  usdc_revenue_pool: string;
  usdc_vaults: string;
};

export type Registry = {
  ownerId: string;
  programs: ProgramView[];
  memberships: MembershipView[];
  accounting: Accounting;
  history: Record<string, Activity[]>;
};

export const emptyRegistry: Registry = {
  ownerId: "",
  programs: [],
  memberships: [],
  accounting: {
    programmes: 0,
    memberships: 0,
    reward_pool: "0",
    revenue_pool: "0",
    vaults: "0",
    usdc_reward_pool: "0",
    usdc_revenue_pool: "0",
    usdc_vaults: "0",
  },
  history: {},
};

export async function viewCall<T>(
  method: string,
  args: object = {},
): Promise<T> {
  if (!CONTRACT_ID)
    throw new Error(
      "NEAR_CONTRACT_ID is empty. Deploy the contract and set it in the root .env.",
    );
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "veyra",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: CONTRACT_ID,
        method_name: method,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  const body = (await response.json()) as {
    error?: { message?: string; data?: unknown };
    result?: { result?: number[]; error?: string };
  };
  if (body.error)
    throw new Error(
      panicText(body.error.data) ||
        body.error.message ||
        "The view call failed",
    );
  if (!body.result) throw new Error("The RPC returned no result");
  if (body.result.error)
    throw new Error(panicText(body.result.error) || body.result.error);
  const bytes = new Uint8Array(body.result.result ?? []);
  const text = new TextDecoder().decode(bytes);
  return (text ? JSON.parse(text) : null) as T;
}

export async function loadRegistry(): Promise<Registry> {
  const [ownerId, programs, memberships, accounting] = await Promise.all([
    viewCall<string>("get_protocol_owner"),
    viewCall<ProgramView[]>("list_programs", { from_index: 0, limit: 50 }),
    viewCall<MembershipView[]>("list_memberships", {
      from_index: 0,
      limit: 100,
    }),
    viewCall<Accounting>("get_accounting"),
  ]);
  const entries = await Promise.all(
    memberships.map(async (membership) => {
      const history = await viewCall<Activity[]>("get_membership_history", {
        token_id: membership.token_id,
      });
      return [membership.token_id, history] as const;
    }),
  );
  return {
    ownerId,
    programs,
    memberships,
    accounting,
    history: Object.fromEntries(entries),
  };
}

export async function findMembership(
  query: string,
): Promise<MembershipView | null> {
  return viewCall<MembershipView | null>("find_membership", { query });
}

export function panicText(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const panic = text.match(/Smart contract panicked: ([^"\\]+)/);
  return panic?.[1] ?? "";
}
