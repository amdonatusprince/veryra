import { PassArt } from "@/components/pass-art";
import { useVeyra } from "@/components/providers";
import { artworkSrc } from "@/lib/artwork";
import { formatPoints, formatUsdc, passAccount, passCode } from "@/lib/format";
import type { MembershipView } from "@/lib/chain";

export function MembershipCard({ membership }: { membership: MembershipView }) {
  const { registry } = useVeyra();
  const symbol =
    registry.programs.find((program) => program.id === membership.program_id)
      ?.symbol ?? "";
  return (
    <article className="overflow-hidden border-2 border-text-primary bg-card text-card-foreground">
      <PassArt
        expandable
        alt={`${membership.program_name} ${membership.tier_name}`}
        media={artworkSrc({
          name: membership.program_name,
          symbol,
          color: membership.color,
          media: membership.media,
        })}
        seed={membership.program_id}
        className="h-48 w-full"
      />
      <div className="border-b border-brass/50 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs tracking-[0.18em] text-card-muted uppercase">
            {membership.program_name}
          </p>
          <p className="text-sm tracking-wide text-brass">
            {passCode(membership.token_id)}
          </p>
        </div>
        <h2 className="mt-8 text-[46px] leading-[0.98] font-black tracking-[-0.035em]">
          {membership.tier_name}
        </h2>
        <p className="mt-1 text-card-muted">
          {passAccount(membership.token_id, membership.bound_account)}
        </p>
      </div>
      <dl className="grid grid-cols-3 border-t border-brass/50">
        <div className="border-r border-brass/40 px-5 py-4">
          <dt className="text-xs text-card-muted">Balance</dt>
          <dd className="mt-1 text-lg tabular-nums">
            {formatUsdc(membership.usdc_vault || "0")}
          </dd>
        </div>
        <div className="border-r border-brass/40 px-5 py-4">
          <dt className="text-xs text-card-muted">XP</dt>
          <dd className="mt-1 text-lg tabular-nums">
            {formatPoints(membership.xp)}
          </dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs text-card-muted">Points</dt>
          <dd className="mt-1 text-lg tabular-nums">
            {formatPoints(membership.points)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
