"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MembershipCard } from "@/components/membership-card";
import { useVeyra } from "@/components/providers";
import { Button } from "@/components/base/buttons/button";
import { PageIntro, Panel, inputClass } from "@/components/ui";
import {
  findMembership,
  viewCall,
  type Activity,
  type MembershipView,
} from "@/lib/chain";
import {
  formatNear,
  formatUsdc,
  passAccount,
  resolvePassId,
} from "@/lib/format";

export function Explorer() {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<MembershipView | null>(null);
  const [history, setHistory] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const { registry } = useVeyra();
  const pathname = usePathname();
  const [resetPath, setResetPath] = useState(pathname);
  if (pathname !== resetPath) {
    setResetPath(pathname);
    setQuery("");
    setCurrent(null);
    setHistory([]);
    setError("");
    setPending(false);
  }

  return (
    <div className="space-y-8">
      <PageIntro eyebrow="Explorer" title="Look up a pass">
        Enter the pass address, such as the bound account, or the token id. The
        page returns that membership.
      </PageIntro>
      <Panel title="Pass address">
        <form
          className="flex flex-col gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            const needle = query.trim();
            setPending(true);
            setError("");
            const knownId = resolvePassId(registry.memberships, needle);
            const known = registry.memberships.find(
              (item) => item.token_id === knownId,
            );
            (known ? Promise.resolve(known) : findMembership(needle))
              .then(async (found) => {
                if (!found) {
                  setCurrent(null);
                  setHistory([]);
                  setError("No membership uses that pass.");
                  return;
                }
                const events = await viewCall<Activity[]>(
                  "get_membership_history",
                  { token_id: found.token_id },
                );
                setCurrent(found);
                setHistory(events);
              })
              .catch((caught: unknown) => {
                setCurrent(null);
                setHistory([]);
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "The lookup failed.",
                );
              })
              .finally(() => setPending(false));
          }}
        >
          <label
            htmlFor="pass-query"
            className="text-body-medium text-text-primary"
          >
            Membership pass
          </label>
          <div className="flex items-center gap-3">
            <input
              id="pass-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              required
              autoComplete="off"
              placeholder="k7np or name.near"
              aria-describedby="pass-query-hint"
              className={`${inputClass} h-[54px] min-w-0 flex-1`}
            />
            <Button type="submit" disabled={pending} className="shrink-0">
              {pending ? "Looking up…" : "Look up"}
            </Button>
          </div>
          <p
            id="pass-query-hint"
            className="text-caption-1-regular text-text-secondary"
          >
            Pass code or bound account.
          </p>
        </form>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      </Panel>
      {current ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <MembershipCard membership={current} />
            <Panel title="Account">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted">Owner</dt>
                  <dd className="break-all text-foreground">
                    {current.owner_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Bound account</dt>
                  <dd className="break-all text-foreground">
                    {passAccount(current.token_id, current.bound_account)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Vault</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatUsdc(current.usdc_vault || "0")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Access</dt>
                  <dd className="text-foreground">
                    {current.paused
                      ? "Programme paused"
                      : current.access_rights.join(", ") || "None on this tier"}
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>
          <Panel title="History">
            {history.length === 0 ? (
              <p className="text-sm text-muted">
                No activity on this pass yet.
              </p>
            ) : (
              <ol className="space-y-4">
                {history
                  .slice()
                  .reverse()
                  .map((item, index) => (
                    <li
                      key={`${item.kind}-${item.at}-${index}`}
                      className="border-b border-line pb-4 last:border-0"
                    >
                      <p className="text-foreground">{labelFor(item.kind)}</p>
                      <p className="mt-1 text-sm text-muted">
                        {item.actor}
                        {item.counterpart ? ` → ${item.counterpart}` : ""}
                        {item.amount
                          ? ` · ${item.detail === "mUSDC" || item.kind === "paid" || item.kind === "cashed_out" ? formatUsdc(item.amount) : `${formatNear(item.amount)} NEAR`}`
                          : ""}
                        {item.detail && item.detail !== "mUSDC"
                          ? ` · ${item.detail}`
                          : ""}
                      </p>
                    </li>
                  ))}
              </ol>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function labelFor(kind: string) {
  const labels: Record<string, string> = {
    issued: "Membership issued",
    bound: "Account bound",
    funded: "Vault funded",
    points_awarded: "Points awarded",
    points_revoked: "Points revoked",
    points_gifted: "Points gifted",
    points_received: "Points received",
    reward_distributed: "Reward distributed",
    revenue_distributed: "Revenue distributed",
    tier_changed: "Tier changed",
    transferred: "Ownership transferred",
    transfer_reverted: "Transfer reverted",
    withdrawn: "Vault withdrawn",
    paid: "Paid from the pass",
  };
  return labels[kind] ?? kind;
}
