"use client";

import { useState } from "react";
import { Pagination } from "@/components/base/pagination/pagination";
import { PassArt } from "@/components/pass-art";
import { useVeyra } from "@/components/providers";
import { LoadingState, Panel, Stat } from "@/components/ui";
import { artworkSrc } from "@/lib/artwork";
import { formatPoints, formatUsdc, passAccount, passCode } from "@/lib/format";

const pageSize = 4;

export function Overview() {
  const { registry, loading } = useVeyra();
  const { accounting, programs, memberships } = registry;
  const [programmePage, setProgrammePage] = useState(1);
  const [passPage, setPassPage] = useState(1);
  const programmePages = Math.max(1, Math.ceil(programs.length / pageSize));
  const passPages = Math.max(1, Math.ceil(memberships.length / pageSize));
  const shownProgrammePage = Math.min(programmePage, programmePages);
  const shownPassPage = Math.min(passPage, passPages);
  const visibleProgrammes = programs.slice(
    (shownProgrammePage - 1) * pageSize,
    shownProgrammePage * pageSize,
  );
  const visiblePasses = memberships.slice(
    (shownPassPage - 1) * pageSize,
    shownPassPage * pageSize,
  );

  return (
    <div className="space-y-8">
      {loading && programs.length === 0 ? (
        <LoadingState label="Reading the contract" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Programmes" value={String(accounting.programmes)} />
            <Stat label="Memberships" value={String(accounting.memberships)} />
            <Stat
              label="Reward pool"
              value={formatUsdc(accounting.usdc_reward_pool || "0")}
            />
            <Stat
              label="Revenue pool"
              value={formatUsdc(accounting.usdc_revenue_pool || "0")}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Programmes">
              {programs.length === 0 ? (
                <p className="text-sm text-muted">
                  No programme yet. Create one from the business page.
                </p>
              ) : (
                <ul className="space-y-3">
                  {visibleProgrammes.map((program) => (
                    <li
                      key={program.id}
                      className="flex items-center gap-3 border-2 border-text-primary p-3"
                    >
                      <PassArt
                        expandable
                        alt={`${program.name} artwork`}
                        media={artworkSrc(program)}
                        seed={program.id}
                        className="h-16 w-16 shrink-0 rounded-xl"
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {program.name}
                        </p>
                        <p className="text-sm text-muted">
                          {program.symbol} · {program.membership_count}{" "}
                          {program.membership_count === 1 ? "pass" : "passes"}
                          {program.paused ? " · paused" : ""}
                        </p>
                        <p className="text-sm text-muted">{program.owner_id}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Pagination
                className="mt-4"
                aria-label="Programme pages"
                page={shownProgrammePage}
                totalPages={programmePages}
                onChange={setProgrammePage}
              />
            </Panel>
            <Panel title="Passes">
              {memberships.length === 0 ? (
                <p className="text-sm text-muted">No pass issued yet.</p>
              ) : (
                <ul className="space-y-3">
                  {visiblePasses.map((membership) => (
                    <li
                      key={membership.token_id}
                      className="flex items-center gap-3 border-2 border-text-primary p-3"
                    >
                      <PassArt
                        expandable
                        alt={`${membership.program_name} pass`}
                        media={artworkSrc({
                          name: membership.program_name,
                          symbol: programs.find(
                            (program) => program.id === membership.program_id,
                          )?.symbol,
                          color: membership.color,
                          media: membership.media,
                        })}
                        seed={membership.program_id}
                        className="h-16 w-16 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="text-foreground">
                          {passCode(membership.token_id)} ·{" "}
                          {membership.program_name}
                        </p>
                        <p className="truncate text-sm text-muted">
                          {passAccount(
                            membership.token_id,
                            membership.bound_account,
                          )}
                        </p>
                        <p className="text-sm tabular-nums text-muted">
                          {membership.tier_name} ·{" "}
                          {formatPoints(membership.points)} pts ·{" "}
                          {formatUsdc(membership.usdc_vault || "0")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Pagination
                className="mt-4"
                aria-label="Pass pages"
                page={shownPassPage}
                totalPages={passPages}
                onChange={setPassPage}
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
