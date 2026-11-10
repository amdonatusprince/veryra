export type Tier = {
  id: string;
  name: string;
  xp_threshold: number;
  revenue_share_bps: number;
  access_rights: string[];
};

export type Program = {
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
};

export type Membership = {
  token_id: string;
  program_id: string;
  tier_id: string;
  xp: number;
  points: number;
  bound_account: string | null;
  vault: string;
  seq: number;
  owner_id: string;
  approvals: Record<string, number>;
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

export type MembershipView = Membership & {
  program_name: string;
  tier_name: string;
  xp_to_next: number | null;
  access_rights: string[];
  paused: boolean;
  bound_account: string;
};

export type AccountView = {
  token_id: string;
  bound_account: string;
  controller: string;
  vault: string;
  program_id: string;
};

export type Accounting = {
  programmes: number;
  memberships: number;
  reward_pool: string;
  revenue_pool: string;
  vaults: string;
};

export type ProtocolState = {
  owner_id: string;
  contract_id: string;
  programs: Program[];
  memberships: Membership[];
  history: Record<string, Activity[]>;
  program_history: Record<string, Activity[]>;
  next_token: number;
  total_vault: string;
};

export function emptyState(contractId = "veyra.test.near"): ProtocolState {
  return {
    owner_id: "protocol.near",
    contract_id: contractId,
    programs: [],
    memberships: [],
    history: {},
    program_history: {},
    next_token: 0,
    total_vault: "0",
  };
}

function slug(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    throw new Error(`${label} must be 2-32 characters`);
  }
  if (!/^[a-z][a-z0-9_-]*$/.test(trimmed)) {
    throw new Error(
      `${label} must start with a letter and use lowercase letters, digits, hyphens, or underscores`,
    );
  }
  return trimmed;
}

function label(value: string, max: number, name: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`${name} is required`);
  return trimmed;
}

function validateTiers(tiers: Tier[]) {
  if (tiers.length === 0) throw new Error("Add at least one tier");
  if (tiers.length > 12)
    throw new Error("A programme can have at most 12 tiers");
  if (!tiers.some((tier) => tier.xp_threshold === 0)) {
    throw new Error("Include a tier with an XP threshold of 0");
  }
  const ids = new Set<string>();
  const thresholds = new Set<number>();
  let bps = 0;
  for (const tier of tiers) {
    const id = slug(tier.id, "Tier id");
    if (ids.has(id)) throw new Error("Tier ids must be unique");
    ids.add(id);
    if (thresholds.has(tier.xp_threshold))
      throw new Error("XP thresholds must be unique");
    thresholds.add(tier.xp_threshold);
    label(tier.name, 32, "Tier name");
    bps += tier.revenue_share_bps;
    if (bps > 10_000) throw new Error("Tier shares cannot exceed 100%");
    const rights = new Set<string>();
    for (const right of tier.access_rights) {
      const clean = slug(right, "Access right");
      if (rights.has(clean))
        throw new Error("Access rights must be unique within a tier");
      rights.add(clean);
    }
  }
}

function add(amount: string, delta: bigint, overflow: string): string {
  const next = BigInt(amount) + delta;
  if (next < 0n) throw new Error(overflow);
  return next.toString();
}

function tierForXp(tiers: Tier[], xp: number): Tier {
  const match = tiers
    .filter((tier) => tier.xp_threshold <= xp)
    .sort((a, b) => b.xp_threshold - a.xp_threshold)[0];
  if (!match) throw new Error("No tier matches this XP");
  return match;
}

export class VeyraProtocol {
  state: ProtocolState;
  private caller: string;
  private now: () => number;

  constructor(
    state: ProtocolState,
    caller: string,
    now: () => number = () => Date.now(),
  ) {
    this.state = state;
    this.caller = caller;
    this.now = now;
  }

  private program(id: string): Program {
    const program = this.state.programs.find((item) => item.id === id);
    if (!program) throw new Error("Programme not found");
    return program;
  }

  private membership(tokenId: string): Membership {
    const membership = this.state.memberships.find(
      (item) => item.token_id === tokenId,
    );
    if (!membership) throw new Error("Membership not found");
    return membership;
  }

  private assertOwner(program: Program) {
    if (program.owner_id !== this.caller)
      throw new Error("Only the programme owner");
  }

  private assertActive(program: Program) {
    if (program.paused) throw new Error("Programme is paused");
  }

  private assertOwnerActive(id: string): Program {
    const program = this.program(id);
    this.assertOwner(program);
    this.assertActive(program);
    return program;
  }

  private activity(
    kind: string,
    extra: Partial<
      Pick<Activity, "amount" | "memo" | "counterpart" | "detail">
    > = {},
  ): Activity {
    return {
      kind,
      actor: this.caller,
      at: this.now(),
      amount: extra.amount ?? null,
      memo: extra.memo ?? null,
      counterpart: extra.counterpart ?? null,
      detail: extra.detail ?? null,
    };
  }

  private pushHistory(tokenId: string, activity: Activity) {
    const items = this.state.history[tokenId] ?? [];
    items.push(activity);
    this.state.history[tokenId] = items;
    const membership = this.state.memberships.find(
      (item) => item.token_id === tokenId,
    );
    if (membership) this.pushProgram(membership.program_id, activity);
  }

  private pushProgram(programId: string, activity: Activity) {
    const items = this.state.program_history[programId] ?? [];
    items.push(activity);
    this.state.program_history[programId] = items.slice(-200);
  }

  private credit(tokenId: string, amount: bigint, kind: string) {
    if (amount <= 0n) throw new Error("Amount must be greater than zero");
    const membership = this.membership(tokenId);
    membership.vault = add(membership.vault, amount, "Vault overflow");
    this.state.total_vault = add(
      this.state.total_vault,
      amount,
      "Vault overflow",
    );
    this.pushHistory(
      tokenId,
      this.activity(kind, { amount: amount.toString() }),
    );
  }

  private syncTier(tokenId: string) {
    const membership = this.membership(tokenId);
    const program = this.program(membership.program_id);
    const next = tierForXp(program.tiers, membership.xp);
    if (next.id === membership.tier_id) return;
    const previous = membership.tier_id;
    const previousCount = program.tier_counts[previous] ?? 0;
    if (previousCount <= 0) throw new Error("Tier count is already zero");
    program.tier_counts[previous] = previousCount - 1;
    program.tier_counts[next.id] = (program.tier_counts[next.id] ?? 0) + 1;
    membership.tier_id = next.id;
    this.pushHistory(
      tokenId,
      this.activity("tier_changed", { detail: `${previous} -> ${next.id}` }),
    );
  }

  private view(membership: Membership): MembershipView {
    const program = this.program(membership.program_id);
    const tier = program.tiers.find((item) => item.id === membership.tier_id);
    if (!tier || !membership.bound_account)
      throw new Error("Membership not found");
    const next = program.tiers
      .filter((item) => item.xp_threshold > membership.xp)
      .map((item) => item.xp_threshold)
      .sort((a, b) => a - b)[0];
    return {
      ...membership,
      bound_account: membership.bound_account,
      program_name: program.name,
      tier_name: tier.name,
      xp_to_next: next === undefined ? null : next - membership.xp,
      access_rights: [...tier.access_rights],
      paused: program.paused,
    };
  }

  createProgram(
    programId: string,
    name: string,
    symbol: string,
    tiers: Tier[],
  ): Program {
    const id = slug(programId, "Programme id");
    if (this.state.programs.some((program) => program.id === id)) {
      throw new Error("Programme id already exists");
    }
    validateTiers(tiers);
    const program: Program = {
      id,
      owner_id: this.caller,
      name: label(name, 64, "Name"),
      symbol: label(symbol, 12, "Symbol"),
      paused: false,
      tiers: tiers.map((tier) => ({
        ...tier,
        id: slug(tier.id, "Tier id"),
        name: label(tier.name, 32, "Tier name"),
        access_rights: tier.access_rights.map((right) =>
          slug(right, "Access right"),
        ),
      })),
      tier_counts: Object.fromEntries(
        tiers.map((tier) => [slug(tier.id, "Tier id"), 0]),
      ),
      reward_pool: "0",
      revenue_pool: "0",
      membership_count: 0,
    };
    this.state.programs.push(program);
    this.pushProgram(id, this.activity("programme_created"));
    return program;
  }

  updateProgram(programId: string, name: string, symbol: string): Program {
    const program = this.program(programId);
    this.assertOwner(program);
    program.name = label(name, 64, "Name");
    program.symbol = label(symbol, 12, "Symbol");
    this.pushProgram(program.id, this.activity("programme_updated"));
    return program;
  }

  pauseProgram(programId: string): Program {
    const program = this.program(programId);
    this.assertOwner(program);
    if (program.paused) throw new Error("Programme is paused");
    program.paused = true;
    this.pushProgram(program.id, this.activity("programme_paused"));
    return program;
  }

  resumeProgram(programId: string): Program {
    const program = this.program(programId);
    this.assertOwner(program);
    if (!program.paused) throw new Error("Programme is active");
    program.paused = false;
    this.pushProgram(program.id, this.activity("programme_resumed"));
    return program;
  }

  configureTiers(programId: string, tiers: Tier[]): Program {
    const program = this.program(programId);
    this.assertOwner(program);
    validateTiers(tiers);
    for (const [id, count] of Object.entries(program.tier_counts)) {
      if (count > 0 && !tiers.some((tier) => slug(tier.id, "Tier id") === id)) {
        throw new Error("Cannot remove a tier that still has members");
      }
    }
    const counts: Record<string, number> = {};
    for (const tier of tiers)
      counts[slug(tier.id, "Tier id")] =
        program.tier_counts[slug(tier.id, "Tier id")] ?? 0;
    program.tiers = tiers.map((tier) => ({
      ...tier,
      id: slug(tier.id, "Tier id"),
      name: label(tier.name, 32, "Tier name"),
      access_rights: tier.access_rights.map((right) =>
        slug(right, "Access right"),
      ),
    }));
    program.tier_counts = counts;
    for (const membership of this.state.memberships.filter(
      (item) => item.program_id === program.id,
    )) {
      this.syncTier(membership.token_id);
    }
    this.pushProgram(program.id, this.activity("tiers_configured"));
    return program;
  }

  getProgram(programId: string): Program | null {
    return (
      this.state.programs.find((program) => program.id === programId) ?? null
    );
  }

  listPrograms(): Program[] {
    return [...this.state.programs];
  }

  fundRewards(programId: string, amount: bigint): Program {
    const program = this.assertOwnerActive(programId);
    if (amount <= 0n) throw new Error("Attach NEAR to fund rewards");
    program.reward_pool = add(
      program.reward_pool,
      amount,
      "Reward pool overflow",
    );
    this.pushProgram(
      program.id,
      this.activity("rewards_funded", { amount: amount.toString() }),
    );
    return program;
  }

  issueMembership(
    programId: string,
    receiverId: string,
    tierId?: string,
    title?: string,
  ): MembershipView {
    const program = this.assertOwnerActive(programId);
    const tier = tierId
      ? program.tiers.find((item) => item.id === tierId)
      : program.tiers.find((item) => item.xp_threshold === 0);
    if (!tier) throw new Error("Tier not found");
    this.state.next_token += 1;
    const seq = this.state.next_token;
    const tokenId = `m${seq}`;
    const membership: Membership = {
      token_id: tokenId,
      program_id: program.id,
      tier_id: tier.id,
      xp: tier.xp_threshold,
      points: tier.xp_threshold,
      bound_account: null,
      vault: "0",
      seq,
      owner_id: receiverId,
      approvals: {},
    };
    this.state.memberships.push(membership);
    program.tier_counts[tier.id] = (program.tier_counts[tier.id] ?? 0) + 1;
    program.membership_count += 1;
    this.pushHistory(
      tokenId,
      this.activity("issued", {
        counterpart: receiverId,
        detail: title?.trim() || null,
      }),
    );
    this.bindAccount(tokenId);
    return this.view(this.membership(tokenId));
  }

  bindAccount(tokenId: string): AccountView {
    const membership = this.membership(tokenId);
    const program = this.program(membership.program_id);
    this.assertOwner(program);
    if (!membership.bound_account) {
      membership.bound_account = `m${membership.seq}.${this.state.contract_id}`;
      this.pushHistory(
        tokenId,
        this.activity("bound", {
          counterpart: membership.bound_account,
          detail: "Account control follows the NFT",
        }),
      );
    }
    return this.getAccount(tokenId);
  }

  getMembership(tokenId: string): MembershipView | null {
    const membership = this.state.memberships.find(
      (item) => item.token_id === tokenId,
    );
    return membership ? this.view(membership) : null;
  }

  membershipsForOwner(accountId: string): MembershipView[] {
    return this.state.memberships
      .filter((item) => item.owner_id === accountId)
      .map((item) => this.view(item));
  }

  membershipsForProgram(programId: string): MembershipView[] {
    return this.state.memberships
      .filter((item) => item.program_id === programId)
      .map((item) => this.view(item));
  }

  listMemberships(): MembershipView[] {
    return this.state.memberships.map((item) => this.view(item));
  }

  fundMembership(tokenId: string, amount: bigint): AccountView {
    this.membership(tokenId);
    if (amount <= 0n) throw new Error("Attach NEAR to fund the membership");
    this.credit(tokenId, amount, "funded");
    return this.getAccount(tokenId);
  }

  withdraw(tokenId: string, amount: bigint): AccountView {
    const membership = this.membership(tokenId);
    if (membership.owner_id !== this.caller)
      throw new Error("Only the current owner");
    if (amount <= 0n) throw new Error("Amount must be greater than zero");
    if (BigInt(membership.vault) < amount)
      throw new Error("Insufficient vault");
    membership.vault = (BigInt(membership.vault) - amount).toString();
    this.state.total_vault = (
      BigInt(this.state.total_vault) - amount
    ).toString();
    this.pushHistory(
      tokenId,
      this.activity("withdrawn", {
        amount: amount.toString(),
        counterpart: this.caller,
      }),
    );
    return this.getAccount(tokenId);
  }

  getAccount(tokenId: string): AccountView {
    const membership = this.membership(tokenId);
    if (!membership.bound_account)
      throw new Error("Membership has no bound account");
    return {
      token_id: tokenId,
      bound_account: membership.bound_account,
      controller: membership.owner_id,
      vault: membership.vault,
      program_id: membership.program_id,
    };
  }

  awardPoints(tokenId: string, points: number, memo?: string): MembershipView {
    if (points <= 0) throw new Error("Points must be greater than zero");
    const membership = this.membership(tokenId);
    this.assertOwnerActive(membership.program_id);
    membership.points += points;
    membership.xp += points;
    this.pushHistory(
      tokenId,
      this.activity("points_awarded", {
        memo: memo ?? null,
        detail: String(points),
      }),
    );
    this.syncTier(tokenId);
    return this.view(this.membership(tokenId));
  }

  revokePoints(tokenId: string, points: number, memo?: string): MembershipView {
    if (points <= 0) throw new Error("Points must be greater than zero");
    const membership = this.membership(tokenId);
    this.assertOwnerActive(membership.program_id);
    if (membership.points < points) throw new Error("Insufficient points");
    membership.points -= points;
    membership.xp = Math.max(0, membership.xp - points);
    this.pushHistory(
      tokenId,
      this.activity("points_revoked", {
        memo: memo ?? null,
        detail: String(points),
      }),
    );
    this.syncTier(tokenId);
    return this.view(membership);
  }

  giftPoints(
    fromTokenId: string,
    toTokenId: string,
    points: number,
    memo?: string,
  ): MembershipView {
    if (points <= 0) throw new Error("Points must be greater than zero");
    if (fromTokenId === toTokenId)
      throw new Error("Choose a different membership");
    const from = this.membership(fromTokenId);
    const to = this.membership(toTokenId);
    if (from.program_id !== to.program_id) {
      throw new Error("Memberships must belong to the same programme");
    }
    if (from.owner_id !== this.caller)
      throw new Error("Only the current owner");
    this.assertActive(this.program(from.program_id));
    if (from.points < points) throw new Error("Insufficient points");
    from.points -= points;
    to.points += points;
    this.pushHistory(
      fromTokenId,
      this.activity("points_gifted", {
        counterpart: to.owner_id,
        memo: memo ?? null,
        detail: String(points),
      }),
    );
    this.pushHistory(
      toTokenId,
      this.activity("points_received", {
        counterpart: this.caller,
        memo: memo ?? null,
        detail: String(points),
      }),
    );
    return this.view(from);
  }

  distributeReward(
    programId: string,
    tokenId: string,
    amount: bigint,
  ): AccountView {
    const program = this.assertOwnerActive(programId);
    const membership = this.membership(tokenId);
    if (membership.program_id !== programId)
      throw new Error("Membership is not in this programme");
    if (amount <= 0n) throw new Error("Amount must be greater than zero");
    if (BigInt(program.reward_pool) < amount)
      throw new Error("Insufficient reward pool");
    program.reward_pool = (BigInt(program.reward_pool) - amount).toString();
    this.credit(tokenId, amount, "reward_distributed");
    return this.getAccount(tokenId);
  }

  recordRevenue(programId: string, amount: bigint): Program {
    const program = this.assertOwnerActive(programId);
    if (amount <= 0n) throw new Error("Attach NEAR to record revenue");
    program.revenue_pool = add(
      program.revenue_pool,
      amount,
      "Revenue pool overflow",
    );
    this.pushProgram(
      program.id,
      this.activity("revenue_recorded", { amount: amount.toString() }),
    );
    return program;
  }

  distributeRevenue(programId: string): Program {
    const program = this.assertOwnerActive(programId);
    const pool = BigInt(program.revenue_pool);
    if (pool <= 0n) throw new Error("Revenue pool is empty");
    const members = this.state.memberships.filter(
      (item) => item.program_id === programId,
    );
    if (members.length === 0) throw new Error("No memberships to pay");
    let paid = 0n;
    for (const tier of program.tiers) {
      if (tier.revenue_share_bps === 0) continue;
      const group = members.filter((item) => item.tier_id === tier.id);
      if (group.length === 0) continue;
      const share = (pool * BigInt(tier.revenue_share_bps)) / 10_000n;
      const each = share / BigInt(group.length);
      if (each === 0n) continue;
      for (const membership of group) {
        this.credit(membership.token_id, each, "revenue_distributed");
        paid += each;
      }
    }
    if (paid === 0n) throw new Error("Nothing to distribute");
    program.revenue_pool = (pool - paid).toString();
    this.pushProgram(
      program.id,
      this.activity("revenue_distributed", { amount: paid.toString() }),
    );
    return program;
  }

  verifyMembership(
    ownerId: string,
    programId: string,
    right?: string,
  ): boolean {
    const program = this.state.programs.find((item) => item.id === programId);
    if (!program || program.paused) return false;
    return this.state.memberships.some((membership) => {
      if (
        membership.owner_id !== ownerId ||
        membership.program_id !== programId
      )
        return false;
      if (!right) return true;
      const tier = program.tiers.find((item) => item.id === membership.tier_id);
      return tier?.access_rights.includes(right) ?? false;
    });
  }

  checkAccess(tokenId: string, right: string): boolean {
    const membership = this.state.memberships.find(
      (item) => item.token_id === tokenId,
    );
    if (!membership) return false;
    const program = this.state.programs.find(
      (item) => item.id === membership.program_id,
    );
    if (!program || program.paused) return false;
    const tier = program.tiers.find((item) => item.id === membership.tier_id);
    return tier?.access_rights.includes(right) ?? false;
  }

  getAccessRights(tokenId: string): string[] {
    return this.view(this.membership(tokenId)).access_rights;
  }

  getMembershipHistory(tokenId: string): Activity[] {
    return [...(this.state.history[tokenId] ?? [])];
  }

  getProgramHistory(programId: string): Activity[] {
    return [...(this.state.program_history[programId] ?? [])];
  }

  getAccounting(): Accounting {
    return {
      programmes: this.state.programs.length,
      memberships: this.state.memberships.length,
      reward_pool: this.state.programs
        .reduce((sum, program) => sum + BigInt(program.reward_pool), 0n)
        .toString(),
      revenue_pool: this.state.programs
        .reduce((sum, program) => sum + BigInt(program.revenue_pool), 0n)
        .toString(),
      vaults: this.state.total_vault,
    };
  }

  transferMembership(receiverId: string, tokenId: string, memo?: string) {
    this.nftTransfer(receiverId, tokenId, memo);
  }

  nftTransfer(receiverId: string, tokenId: string, memo?: string) {
    const membership = this.membership(tokenId);
    const approved = membership.approvals[this.caller] !== undefined;
    if (membership.owner_id !== this.caller && !approved)
      throw new Error("Sender not approved");
    if (membership.owner_id === receiverId)
      throw new Error("Current and next owner must differ");
    const previous = membership.owner_id;
    membership.owner_id = receiverId;
    membership.approvals = {};
    this.pushHistory(
      tokenId,
      this.activity("transferred", {
        counterpart: receiverId,
        memo: memo ?? null,
        detail: `Previous controller ${previous}`,
      }),
    );
  }

  nftTransferCall(
    receiverId: string,
    tokenId: string,
    msg: string,
  ): { reverted: boolean } {
    const previous = this.membership(tokenId).owner_id;
    this.nftTransfer(receiverId, tokenId);
    const revert = msg === "revert";
    if (revert) {
      const membership = this.membership(tokenId);
      membership.owner_id = previous;
      this.pushHistory(tokenId, this.activity("transfer_reverted"));
    }
    return { reverted: revert };
  }

  nftApprove(tokenId: string, accountId: string) {
    const membership = this.membership(tokenId);
    if (membership.owner_id !== this.caller)
      throw new Error("Sender not approved");
    const next =
      Object.values(membership.approvals).reduce(
        (max, id) => Math.max(max, id),
        0,
      ) + 1;
    membership.approvals[accountId] = next;
  }

  nftRevoke(tokenId: string, accountId: string) {
    const membership = this.membership(tokenId);
    if (membership.owner_id !== this.caller)
      throw new Error("Sender not approved");
    delete membership.approvals[accountId];
  }

  nftRevokeAll(tokenId: string) {
    const membership = this.membership(tokenId);
    if (membership.owner_id !== this.caller)
      throw new Error("Sender not approved");
    membership.approvals = {};
  }

  nftIsApproved(tokenId: string, accountId: string): boolean {
    return this.membership(tokenId).approvals[accountId] !== undefined;
  }
}
