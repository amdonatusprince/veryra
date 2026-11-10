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
    <div className="grid items-start gap-16 pt-8 pb-10 lg:grid-cols-2 lg:gap-[72px] lg:pt-12">
      <div>
        <h1 className="max-w-[12ch] text-[clamp(3.4rem,6.6vw,5.75rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-text-primary">
          Assets that own, earn, interact and evolve.
        </h1>
        <p className="mt-7 max-w-[47ch] text-[19px] leading-relaxed text-text-secondary">
          Veyra turns NFTs into programmable economic entities with accounts,
          permissions, rewards, and transferable ownership.
        </p>
        {account ? (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/business" trailingIcon={RiArrowRightLine}>
              Create a programme
            </ButtonLink>
            <ButtonLink
              href="/member"
              variant="secondary"
              trailingIcon={RiArrowRightLine}
            >
              View a membership
            </ButtonLink>
          </div>
        ) : null}
      </div>
      <aside className="min-w-0 border-2 border-text-primary bg-background-primary-default">
        <p className="flex items-center gap-2.5 border-b border-text-primary px-6 py-4 text-[15px] font-semibold text-text-primary">
          <span
            aria-hidden
            className="size-3 border-2 border-text-primary bg-accent-400"
          />
          On the contract
        </p>
        <div className="px-6 py-6">
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
        </div>
      </aside>
    </div>
  );
}
