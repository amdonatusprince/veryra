import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNear } from "../lib/format.ts";
import { VeyraProtocol, emptyState, type Tier } from "../lib/protocol.ts";

const tiers: Tier[] = [
  {
    id: "silver",
    name: "Member",
    xp_threshold: 0,
    revenue_share_bps: 0,
    access_rights: ["events"],
  },
  {
    id: "gold",
    name: "Gold",
    xp_threshold: 100,
    revenue_share_bps: 1000,
    access_rights: ["events", "dinner", "cellar"],
  },
];

function world() {
  const state = emptyState();
  const as = (caller: string) =>
    new VeyraProtocol(state, caller, () => 1_700_000_000_000);
  return { state, as };
}

describe("Veyra demo client", () => {
  it("runs the Harbour transfer end to end", () => {
    const { as } = world();
    const biz = () => as("restaurant.near");
    const alice = () => as("alice.near");
    const bob = () => as("bob.near");

    biz().createProgram("harbour", "Harbour Club", "HRBR", tiers);
    const issued = biz().issueMembership("harbour", "alice.near");
    assert.equal(issued.token_id, "m1");
    assert.equal(issued.bound_account, "m1.veyra.test.near");
    assert.equal(biz().bindAccount("m1").bound_account, issued.bound_account);

    biz().issueMembership("harbour", "bob.near", "silver");
    assert.equal(
      biz().fundMembership("m1", parseNear("10")).vault,
      parseNear("10").toString(),
    );
    biz().fundRewards("harbour", parseNear("5"));
    assert.equal(biz().awardPoints("m1", 100, "dinner").tier_id, "gold");
    assert.equal(alice().giftPoints("m1", "m2", 20).points, 80);
    assert.equal(biz().revokePoints("m2", 5).points, 15);
    assert.equal(
      biz().distributeReward("harbour", "m1", parseNear("2")).vault,
      parseNear("12").toString(),
    );
    biz().recordRevenue("harbour", parseNear("10"));
    const shared = biz().distributeRevenue("harbour");
    assert.equal(shared.revenue_pool, parseNear("9").toString());
    assert.equal(biz().getAccount("m1").vault, parseNear("13").toString());
    assert.equal(biz().getAccount("m2").vault, "0");
    assert.equal(
      biz().verifyMembership("alice.near", "harbour", "dinner"),
      true,
    );
    assert.equal(
      biz().verifyMembership("bob.near", "harbour", "dinner"),
      false,
    );
    assert.equal(biz().checkAccess("m1", "cellar"), true);

    alice().nftApprove("m1", "carol.near");
    assert.equal(alice().nftIsApproved("m1", "carol.near"), true);
    alice().nftRevokeAll("m1");
    assert.equal(alice().nftIsApproved("m1", "carol.near"), false);

    assert.equal(biz().pauseProgram("harbour").paused, true);
    assert.equal(biz().verifyMembership("alice.near", "harbour"), false);
    biz().resumeProgram("harbour");

    const vault = biz().getAccount("m1").vault;
    alice().transferMembership("bob.near", "m1", "sale");
    const moved = bob().getAccount("m1");
    assert.equal(moved.controller, "bob.near");
    assert.equal(moved.vault, vault);
    assert.equal(alice().membershipsForOwner("alice.near").length, 0);
    assert.equal(bob().withdraw("m1", BigInt(vault)).vault, "0");
    const kinds = bob()
      .getMembershipHistory("m1")
      .map((item) => item.kind);
    for (const kind of [
      "issued",
      "bound",
      "funded",
      "points_awarded",
      "tier_changed",
      "transferred",
      "withdrawn",
    ]) {
      assert.ok(kinds.includes(kind), kind);
    }
    assert.equal(biz().getAccounting().vaults, "0");
    assert.equal(biz().listMemberships().length, 2);
  });

  it("rejects the previous owner, a cleared approval, and a cross-programme gift", () => {
    const { as } = world();
    const biz = () => as("restaurant.near");
    biz().createProgram("harbour", "Harbour", "HRB", tiers);
    biz().createProgram("atelier", "Atelier", "ATL", tiers);
    biz().issueMembership("harbour", "alice.near");
    biz().issueMembership("atelier", "alice.near");
    biz().fundMembership("m1", parseNear("1"));
    as("alice.near").nftApprove("m1", "carol.near");
    as("alice.near").transferMembership("bob.near", "m1");
    assert.throws(
      () => as("alice.near").withdraw("m1", parseNear("1")),
      /Only the current owner/,
    );
    assert.throws(
      () => as("carol.near").nftTransfer("alice.near", "m1"),
      /Sender not approved/,
    );
    biz().awardPoints("m2", 10);
    assert.throws(
      () => as("alice.near").giftPoints("m2", "m1", 1),
      /same programme/,
    );
    biz().pauseProgram("harbour");
    assert.throws(() => biz().awardPoints("m1", 1), /Programme is paused/);
  });

  it("reverts a transfer call without moving the vault", () => {
    const { as } = world();
    as("restaurant.near").createProgram("harbour", "Harbour", "HRB", tiers);
    as("restaurant.near").issueMembership("harbour", "alice.near");
    as("restaurant.near").fundMembership("m1", parseNear("4"));
    const result = as("alice.near").nftTransferCall("bob.near", "m1", "revert");
    assert.equal(result.reverted, true);
    assert.equal(as("alice.near").getAccount("m1").controller, "alice.near");
    assert.equal(
      as("alice.near").getAccount("m1").vault,
      parseNear("4").toString(),
    );
  });
});
