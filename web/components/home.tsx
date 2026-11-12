"use client";

import { RiArrowRightLine } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { useVeyra } from "@/components/providers";
import { formatUsdc } from "@/lib/format";

export function Home() {
  const { account, registry, loading } = useVeyra();
  const { accounting, memberships, programs } = registry;
  const latest = memberships.slice(-4).reverse();

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-end">
      <div>
        <h1 className="max-w-3xl text-display-2-regular text-text-primary md:text-display-1-regular">
          Assets that own, earn, interact and evolve.
        </h1>
        <p className="mt-6 max-w-2xl text-title-3-regular text-text-secondary">
          Veyra turns NFTs into programmable economic entities with accounts,
          permissions, rewards, and transferable ownership.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href="/overview" trailingIcon={RiArrowRightLine}>
            See everything on the contract
          </ButtonLink>
          {account ? (
            <>
              <ButtonLink
                href="/business"
                variant="secondary"
                trailingIcon={RiArrowRightLine}
              >
                Create a programme
              </ButtonLink>
              <ButtonLink
                href="/member"
                variant="secondary"
                trailingIcon={RiArrowRightLine}
              >
                View a membership
              </ButtonLink>
            </>
          ) : null}
        </div>
      </div>
      <aside className="rounded-3xl border border-border-button-default bg-background-primary-default p-6">
        <p className="text-caption-1-semibold text-text-secondary uppercase">
          On the contract
        </p>
        {loading && programs.length === 0 ? (
          <p className="mt-4 text-body-regular text-text-secondary">
            Reading the contract.
          </p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-body-regular text-text-secondary">
                  Programmes
                </dt>
                <dd className="mt-1 text-display-4-regular tabular-nums text-text-primary">
                  {accounting.programmes}
                </dd>
              </div>
              <div>
                <dt className="text-body-regular text-text-secondary">
                  Memberships
                </dt>
                <dd className="mt-1 text-display-4-regular tabular-nums text-text-primary">
                  {accounting.memberships}
                </dd>
              </div>
              <div>
                <dt className="text-body-regular text-text-secondary">
                  Reward pool
                </dt>
                <dd className="mt-1 text-body-medium tabular-nums text-text-primary">
                  {formatUsdc(accounting.usdc_reward_pool || "0")}
                </dd>
              </div>
              <div>
                <dt className="text-body-regular text-text-secondary">
                  Revenue pool
                </dt>
                <dd className="mt-1 text-body-medium tabular-nums text-text-primary">
                  {formatUsdc(accounting.usdc_revenue_pool || "0")}
                </dd>
              </div>
            </dl>
            {latest.length > 0 ? (
              <ul className="mt-6 space-y-3 border-t border-separator-border pt-4">
                {latest.map((item) => (
                  <li
                    key={item.token_id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="text-body-regular text-text-primary">
                      {item.token_id} · {item.program_name}
                    </span>
                    <span className="shrink-0 text-body-regular tabular-nums text-text-secondary">
                      {formatUsdc(item.usdc_vault || "0")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-body-regular text-text-secondary">
                No memberships issued yet.
              </p>
            )}
            <ButtonLink
              href="/overview"
              variant="secondary"
              trailingIcon={RiArrowRightLine}
              className="mt-6"
            >
              Open the overview
            </ButtonLink>
          </>
        )}
      </aside>
    </div>
  );
}
