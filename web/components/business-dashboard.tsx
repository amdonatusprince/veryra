"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RiArrowLeftLine, RiArrowRightSLine } from "@remixicon/react";
import { ArtworkField, type ArtworkMode } from "@/components/artwork-field";
import { Button } from "@/components/base/buttons/button";
import { Select, SelectItem } from "@/components/base/select/select";
import { MemberSelect } from "@/components/member-select";
import { Pagination } from "@/components/base/pagination/pagination";
import { PassArt } from "@/components/pass-art";
import { PassCode } from "@/components/pass-code";
import { useVeyra } from "@/components/providers";
import {
  Field,
  Notice,
  PageIntro,
  LoadingState,
  Panel,
  SectionNav,
  inputClass,
  useAction,
} from "@/components/ui";
import { artworkSrc, passImage, storeImageUrl } from "@/lib/artwork";
import {
  CONTRACT_ID,
  GAS,
  MINT_GAS,
  ONE_YOCTO,
  STORAGE_DEPOSIT,
  USDC_TOKEN,
} from "@/lib/config";
import { formatPoints, formatUsdc, parseUsdc, passCode } from "@/lib/format";
import { comparePassesNewest, viewCall, type Tier } from "@/lib/chain";

const pageSize = 4;

const starterTiers = [{ name: "", xp: "0", share: "0", rights: "" }];

function accessRight(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function programmeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `p${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function tierId(name: string, index: number, used: Set<string>) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 16) || `tier${index + 1}`;
  let id = base;
  let extra = 2;
  while (used.has(id)) {
    id = `${base}${extra}`;
    extra += 1;
  }
  used.add(id);
  return id;
}

async function chosenMedia(
  mode: ArtworkMode,
  name: string,
  color: string,
  stored: string,
  source: string,
) {
  if (mode === "default") return passImage(name, "VEYRA", color);
  if (mode === "url") {
    const raw = source.trim();
    if (!raw)
      throw new Error("Enter an image address, or choose the default pass.");
    return stored || storeImageUrl(raw);
  }
  if (!stored) throw new Error("Upload an image, or use the default pass.");
  return stored;
}

export function BusinessDashboard() {
  const { account } = useVeyra();
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("programme");
  const creating = !openId && params.get("view") === "create";

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Business"
        title={
          openId
            ? "Programme"
            : creating
              ? "Create a programme"
              : "Your programmes"
        }
      >
        {openId
          ? "Issue passes, add USDC, and request a payment for this programme."
          : creating
            ? "A programme is the membership. Pick a color, set the tiers, and issue a pass to a member or a claim link."
            : "Programmes this account has created. Open one to issue a pass or move USDC."}
        {account ? ` Signed in as ${account}.` : ""}
      </PageIntro>
      {openId ? (
        <ProgrammeDetail id={openId} />
      ) : (
        <>
          <SectionNav
            label="Business"
            value={creating ? "create" : "programmes"}
            onChange={(next) =>
              router.push(
                next === "create" ? "/business?view=create" : "/business",
              )
            }
            options={[
              { id: "programmes", label: "Your programmes" },
              { id: "create", label: "Create a programme" },
            ]}
          />
          {creating ? <CreateProgram /> : <ProgrammeList />}
        </>
      )}
    </div>
  );
}

function CreateProgram() {
  const { sendCalls } = useVeyra();
  const router = useRouter();
  const { act, error, status, pending } = useAction();
  const [tiers, setTiers] = useState(starterTiers);
  const [color, setColor] = useState("#1f4a3a");
  const [artMode, setArtMode] = useState<ArtworkMode>("default");
  const [storedUrl, setStoredUrl] = useState("");
  const [imageAddress, setImageAddress] = useState("");

  return (
    <div className="space-y-4">
      <Panel title="Create a programme">
        <form
          id="create-programme"
          className="space-y-4"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const name = String(data.get("program-name") ?? "");
            const symbol = "VEYRA";
            const used = new Set<string>();
            const parsed: Tier[] = tiers.map((tier, index) => ({
              id: tierId(tier.name, index, used),
              name: tier.name,
              xp_threshold: index === 0 ? 0 : Number(tier.xp),
              revenue_share_bps: Math.round(Number(tier.share) * 100),
              access_rights: tier.rights
                .split(",")
                .map(accessRight)
                .filter((right) => right.length >= 2),
            }));
            const share = parsed.reduce(
              (sum, tier) => sum + tier.revenue_share_bps,
              0,
            );
            const programId = programmeId();
            void act(
              async () => {
                if (parsed.some((tier) => !tier.name.trim()))
                  throw new Error("Every tier needs a name.");
                if (
                  parsed.some(
                    (tier) =>
                      !Number.isFinite(tier.xp_threshold) ||
                      tier.xp_threshold < 0,
                  )
                )
                  throw new Error("Points to reach must be a number.");
                if (share > 10000)
                  throw new Error("Revenue shares add up to more than 100%.");
                await sendCalls([
                  {
                    methodName: "create_program",
                    args: {
                      program_id: programId,
                      name,
                      symbol,
                      tiers: parsed,
                    },
                    deposit: STORAGE_DEPOSIT,
                    gas: "140000000000000",
                  },
                  {
                    methodName: "set_program_color",
                    args: { program_id: programId, color },
                    deposit: STORAGE_DEPOSIT,
                    gas: "40000000000000",
                  },
                  {
                    methodName: "set_program_media",
                    args: {
                      program_id: programId,
                      media: await chosenMedia(
                        artMode,
                        name,
                        color,
                        storedUrl,
                        imageAddress,
                      ),
                    },
                    deposit: STORAGE_DEPOSIT,
                    gas: "100000000000000",
                  },
                ]);
                router.push(`/business?programme=${programId}`);
              },
              "Programme created. It is listed below once the contract confirms it.",
              event,
            );
          }}
        >
          <Field
            id="program-name"
            label="Name *"
            hint="The name members see on the pass."
          >
            <input
              id="program-name"
              name="program-name"
              required
              autoComplete="organization"
              placeholder="Museum"
              className={inputClass}
            />
          </Field>
          <ArtworkField
            color={color}
            onColor={setColor}
            mode={artMode}
            onMode={setArtMode}
            storedUrl={storedUrl}
            onStoredUrl={setStoredUrl}
            onSource={setImageAddress}
          />
          <fieldset className="space-y-3">
            <legend className="text-sm text-foreground">Tiers</legend>
            <p className="text-xs text-muted">
              The first tier is where a new member starts. Revenue share is the
              percent of recorded revenue that tier receives.
            </p>
            {tiers.map((tier, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-4"
              >
                <Field id={`tier-name-${index}`} label="Name">
                  <input
                    id={`tier-name-${index}`}
                    required
                    value={tier.name}
                    placeholder={index === 0 ? "Member" : "Gold"}
                    onChange={(event) =>
                      updateTier(setTiers, index, "name", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field
                  id={`tier-xp-${index}`}
                  label="Points to reach"
                  hint={
                    index === 0
                      ? "The starting tier is always 0."
                      : "Points a member needs for this tier."
                  }
                >
                  <input
                    id={`tier-xp-${index}`}
                    inputMode="numeric"
                    value={index === 0 ? "0" : tier.xp}
                    disabled={index === 0}
                    placeholder="100"
                    onChange={(event) =>
                      updateTier(setTiers, index, "xp", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field
                  id={`tier-share-${index}`}
                  label="Revenue share %"
                  hint="10 means this tier receives 10% of revenue."
                >
                  <input
                    id={`tier-share-${index}`}
                    inputMode="decimal"
                    value={tier.share}
                    placeholder="10"
                    onChange={(event) =>
                      updateTier(setTiers, index, "share", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field
                  id={`tier-rights-${index}`}
                  label="Access"
                  hint="Comma separated. Events, dinner is stored as events, dinner."
                >
                  <input
                    id={`tier-rights-${index}`}
                    value={tier.rights}
                    placeholder="events"
                    onChange={(event) =>
                      updateTier(setTiers, index, "rights", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-text-primary pt-4">
            {tiers.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTiers((current) => current.slice(0, -1))}
              >
                Remove last tier
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setTiers((current) => [
                  ...current,
                  { name: "", xp: "", share: "0", rights: "" },
                ])
              }
            >
              Add a tier
            </Button>
          </div>
        </form>
      </Panel>
      <Notice error={error} status={status} />
      <Button type="submit" form="create-programme" disabled={pending}>
        {pending ? "Creating…" : "Create programme"}
      </Button>
    </div>
  );
}

function ProgrammeList() {
  const { account, registry, loading, loadError, refresh, openDialog } =
    useVeyra();
  const router = useRouter();
  const params = useSearchParams();
  const programmeOrder = new Map(
    registry.programs.map((program, index) => [program.id, index]),
  );
  const owned = account
    ? registry.programs
        .filter((item) => item.owner_id === account)
        .slice()
        .sort(
          (a, b) =>
            (programmeOrder.get(a.id) ?? 0) - (programmeOrder.get(b.id) ?? 0),
        )
    : [];
  const pageCount = Math.max(1, Math.ceil(owned.length / pageSize));
  const requested = Number(params.get("page") || "1");
  const page = Number.isFinite(requested)
    ? Math.min(pageCount, Math.max(1, requested))
    : 1;
  const visible = owned.slice((page - 1) * pageSize, page * pageSize);

  function openPage(next: number) {
    router.push(next <= 1 ? "/business" : `/business?page=${next}`);
  }

  if (!account) {
    return (
      <Panel title="Your programmes">
        <p className="text-sm text-muted">
          Sign in to see the programmes this account has created, then issue a
          pass or a claim link.
        </p>
        <Button type="button" className="mt-4" onClick={openDialog}>
          Sign in
        </Button>
      </Panel>
    );
  }

  if (loading && owned.length === 0) {
    return (
      <Panel title="Your programmes">
        <LoadingState label="Reading programmes" />
      </Panel>
    );
  }

  if (loadError && owned.length === 0) {
    return (
      <Panel title="Your programmes">
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => void refresh()}
        >
          Try again
        </Button>
      </Panel>
    );
  }

  if (owned.length === 0) {
    return (
      <Panel title="Your programmes">
        <p className="text-sm text-muted">
          None yet. Create one above and it is stored on the contract under this
          account.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Your programmes">
      <ul className="space-y-3">
        {visible.map((program) => (
          <li key={program.id}>
            <div className="flex min-h-20 items-center gap-3 border-2 border-text-primary bg-background-primary-default p-3">
              <PassArt
                expandable
                alt={`${program.name} artwork`}
                media={artworkSrc(program)}
                seed={program.id}
                className="h-16 w-16 shrink-0 rounded-xl"
              />
              <button
                type="button"
                className="flex min-h-16 min-w-0 flex-1 items-center gap-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                onClick={() =>
                  router.push(
                    `/business?programme=${program.id}${page > 1 ? `&page=${page}` : ""}`,
                  )
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body-medium text-text-primary">
                    {program.name}
                  </span>
                  <span className="mt-1 block text-caption-1-regular text-text-secondary">
                    {program.membership_count}{" "}
                    {program.membership_count === 1 ? "pass" : "passes"}
                    {program.paused ? " · paused" : ""} ·{" "}
                    {formatUsdc(program.usdc_reward_pool || "0")} rewards
                  </span>
                </span>
                <RiArrowRightSLine
                  className="size-5 shrink-0 text-foreground-icon-tertiary"
                  aria-hidden
                />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Pagination
        className="mt-4"
        aria-label="Programme pages"
        page={page}
        totalPages={pageCount}
        onChange={openPage}
      />
    </Panel>
  );
}

function ProgrammeDetail({ id }: { id: string }) {
  const { account, registry, loading, send, sendCalls, openDialog } =
    useVeyra();
  const router = useRouter();
  const params = useSearchParams();
  const program = registry.programs.find(
    (item) => item.id === id && item.owner_id === account,
  );
  const { act, error, status, pending } = useAction();
  const [claimId, setClaimId] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [section, setSection] = useState<
    "details" | "issue" | "members" | "value" | "points" | "payment"
  >("issue");
  const [valueView, setValueView] = useState<
    "claim" | "vault" | "rewards" | "pay"
  >("claim");
  const [pointsView, setPointsView] = useState<"points" | "revenue">("points");
  const [revenueView, setRevenueView] = useState<"record" | "distribute">(
    "record",
  );
  const [memberPage, setMemberPage] = useState(1);
  const [artMode, setArtMode] = useState<ArtworkMode>("default");
  const [artColor, setArtColor] = useState(program?.color || "#1f4a3a");
  const [artUrl, setArtUrl] = useState("");
  const [imageAddress, setImageAddress] = useState("");
  useEffect(() => {
    if (!claimId) return;
    let stop = false;
    const timer = setInterval(() => {
      viewCall<string | null>("get_claim", { claim_id: claimId })
        .then((found) => {
          if (!stop && !found) {
            setClaimId("");
            setClaimUrl("");
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [claimId]);
  if (!account) {
    return (
      <Panel title="Programme">
        <p className="text-sm text-muted">
          Sign in to open this programme, issue a pass, or request a payment.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={openDialog}>
            Sign in
          </Button>
          <Button
            type="button"
            variant="secondary"
            leadingIcon={RiArrowLeftLine}
            onClick={() => router.push(backHref(params))}
          >
            All programmes
          </Button>
        </div>
      </Panel>
    );
  }
  if (!program) {
    return (
      <Panel title="Programme">
        {loading ? (
          <LoadingState label="Reading this programme" />
        ) : (
          <p className="text-sm text-muted">
            This account does not have that programme.
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          leadingIcon={RiArrowLeftLine}
          className="mt-4"
          onClick={() => router.push(backHref(params))}
        >
          All programmes
        </Button>
      </Panel>
    );
  }
  const mine = account === program.owner_id;
  const members = registry.memberships
    .filter((item) => item.program_id === program.id)
    .slice()
    .sort(comparePassesNewest);
  const memberPages = Math.max(1, Math.ceil(members.length / pageSize));
  const shownMemberPage = Math.min(memberPage, memberPages);
  const visibleMembers = members.slice(
    (shownMemberPage - 1) * pageSize,
    shownMemberPage * pageSize,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          type="button"
          variant="secondary"
          leadingIcon={RiArrowLeftLine}
          onClick={() => router.push(backHref(params))}
        >
          All programmes
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!mine || pending}
            onClick={() =>
              void act(
                () =>
                  send(
                    program.paused ? "resume_program" : "pause_program",
                    { program_id: program.id },
                    { gas: GAS },
                  ),
                program.paused ? "Programme resumed." : "Programme paused.",
              )
            }
          >
            {program.paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Reward pool</dt>
          <dd className="tabular-nums text-foreground">
            {formatUsdc(program.usdc_reward_pool || "0")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Revenue pool</dt>
          <dd className="tabular-nums text-foreground">
            {formatUsdc(program.usdc_revenue_pool || "0")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Tiers</dt>
          <dd className="text-foreground">
            {program.tiers.map((tier) => tier.name).join(", ")}
          </dd>
        </div>
      </dl>
      {!mine ? (
        <p className="mt-4 text-sm text-muted">
          Sign in as {program.owner_id} to manage this programme.
        </p>
      ) : null}
      <SectionNav
        label="Programme actions"
        value={section}
        onChange={setSection}
        options={[
          { id: "issue", label: "Issue" },
          { id: "members", label: "Members" },
          { id: "value", label: "Value" },
          { id: "points", label: "Points" },
          { id: "payment", label: "Payment" },
          { id: "details", label: "Details" },
        ]}
      />
      <Notice error={error} status={status} />
      {section === "details" ? (
        <Panel title={program.name}>
          <form
            key={program.id}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              void act(
                () =>
                  send(
                    "update_program",
                    {
                      program_id: program.id,
                      name: String(data.get("edit-name") ?? ""),
                      symbol: "VEYRA",
                    },
                    { gas: GAS },
                  ),
                "Programme updated.",
                event,
              );
            }}
          >
            <Field id="edit-name" label="Name">
              <input
                id="edit-name"
                name="edit-name"
                required
                defaultValue={program.name}
                className={inputClass}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={!mine || pending}
            >
              Save
            </Button>
          </form>
          <div className="mt-4 space-y-3">
            <ArtworkField
              color={artColor}
              onColor={setArtColor}
              mode={artMode}
              onMode={setArtMode}
              storedUrl={artUrl}
              onStoredUrl={setArtUrl}
              onSource={setImageAddress}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!mine || pending}
              onClick={() => {
                void act(async () => {
                  const media = await chosenMedia(
                    artMode,
                    program.name,
                    artColor,
                    artUrl,
                    imageAddress,
                  );
                  await sendCalls([
                    {
                      methodName: "set_program_color",
                      args: { program_id: program.id, color: artColor },
                      deposit: STORAGE_DEPOSIT,
                      gas: "80000000000000",
                    },
                    {
                      methodName: "set_program_media",
                      args: { program_id: program.id, media },
                      deposit: STORAGE_DEPOSIT,
                      gas: "180000000000000",
                    },
                  ]);
                }, "Pass artwork updated.");
              }}
            >
              Update artwork
            </Button>
          </div>
        </Panel>
      ) : null}

      {section === "issue" ? (
        <Panel title="Issue a membership">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              const tier = String(data.get("tier") ?? "");
              void act(
                () =>
                  send(
                    "issue_membership",
                    {
                      program_id: program.id,
                      receiver_id: String(data.get("receiver") ?? ""),
                      tier_id: tier && tier !== "starting" ? tier : null,
                      title: null,
                      description: null,
                    },
                    { deposit: STORAGE_DEPOSIT, gas: MINT_GAS },
                  ),
                "Membership issued.",
                event,
              );
            }}
          >
            <Field id="receiver" label="Member account *">
              <input
                id="receiver"
                name="receiver"
                required
                autoComplete="off"
                placeholder="member.testnet"
                className={inputClass}
              />
            </Field>
            <Field id="tier" label="Tier">
              <Select
                aria-label="Tier"
                name="tier"
                defaultSelectedKey="starting"
                className="w-full"
                triggerClassName="min-h-12 !rounded-none !border-2 !border-text-primary !px-4 !shadow-none"
                popoverClassName="!rounded-none !border-2 !border-text-primary !shadow-none"
              >
                <SelectItem id="starting" textValue="Starting tier">
                  Starting tier
                </SelectItem>
                {program.tiers.map((tier) => (
                  <SelectItem key={tier.id} id={tier.id} textValue={tier.name}>
                    {tier.name}
                  </SelectItem>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={!mine || pending}>
                Issue to this account
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!mine || pending}
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (!form) return;
                  const id = programmeId().replace(/^p/, "c");
                  const picked = String(new FormData(form).get("tier") ?? "");
                  const tier = picked && picked !== "starting" ? picked : null;
                  void act(async () => {
                    await send(
                      "open_claim",
                      {
                        claim_id: id,
                        program_id: program.id,
                        tier_id: tier,
                        title: null,
                      },
                      { deposit: STORAGE_DEPOSIT, gas: GAS },
                    );
                    setClaimId(id);
                    setClaimUrl(`${window.location.origin}/claim/${id}`);
                  }, "Claim link is ready. It disappears after someone claims the pass.");
                }}
              >
                Create a claim link
              </Button>
            </div>
          </form>
          {claimUrl ? (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <PassCode value={claimUrl} label="Claim this pass" />
              <p className="max-w-sm text-sm text-muted">
                Scan to mint. The code clears when the pass is claimed.{" "}
                {claimUrl}
              </p>
            </div>
          ) : null}
          <p className="mt-4 max-w-xl text-sm text-muted">
            Each pass gets its own code. Open Members to see the customers.
          </p>
        </Panel>
      ) : null}
      {section === "members" ? (
        <Panel title="Members">
          <p className="max-w-xl text-sm text-muted">
            Customers who hold a pass in this programme. The code tracks that
            pass.
          </p>
          {members.length === 0 ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted">
                No members yet. Issue a pass first.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSection("issue")}
              >
                Issue a pass
              </Button>
            </div>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-line text-sm">
                {visibleMembers.map((member) => (
                  <li
                    key={member.token_id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                  >
                    <span className="text-foreground">
                      <span className="font-medium tracking-wide">
                        {passCode(member.token_id)}
                      </span>
                      <span className="mt-1 block text-muted">
                        {member.owner_id}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted">
                      {member.tier_name} · {formatPoints(member.points)} pts ·{" "}
                      {formatUsdc(member.usdc_vault || "0")}
                    </span>
                  </li>
                ))}
              </ul>
              <Pagination
                className="mt-4"
                aria-label="Member pages"
                page={shownMemberPage}
                totalPages={memberPages}
                onChange={setMemberPage}
              />
            </>
          )}
        </Panel>
      ) : null}

      {section === "value" ? (
        <Panel title="Add value">
          <SectionNav
            label="Value actions"
            value={valueView}
            onChange={setValueView}
            options={[
              { id: "claim", label: "Claim" },
              { id: "vault", label: "Fund vault" },
              { id: "rewards", label: "Reward pool" },
              { id: "pay", label: "Pay reward" },
            ]}
          />
          {valueView === "claim" ? (
            <div className="mt-4 space-y-4">
              <p className="max-w-xl text-sm text-muted">
                Take 1,000.00 USDC once a day. Send it into a pass or a pool
                after that.
              </p>
              <Button
                type="button"
                disabled={pending || !USDC_TOKEN}
                onClick={() =>
                  void act(
                    () =>
                      send(
                        "faucet",
                        { account_id: null },
                        { receiverId: USDC_TOKEN, gas: GAS },
                      ),
                    "Claimed 1,000.00 USDC.",
                  )
                }
              >
                Claim 1,000 USDC
              </Button>
            </div>
          ) : null}
          {valueView === "vault" && members.length === 0 ? (
            <IssuePassFirst onIssue={() => setSection("issue")} />
          ) : null}
          {valueView === "vault" && members.length > 0 ? (
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                void act(
                  () =>
                    send(
                      "ft_transfer_call",
                      {
                        receiver_id: CONTRACT_ID,
                        amount: parseUsdc(
                          String(data.get("fund-amount")),
                        ).toString(),
                        memo: null,
                        msg: `vault:${String(data.get("fund-token"))}`,
                      },
                      {
                        receiverId: USDC_TOKEN,
                        deposit: ONE_YOCTO,
                        gas: MINT_GAS,
                      },
                    ),
                  "Value added to the pass.",
                  event,
                );
              }}
            >
              <p className="max-w-xl text-sm text-muted">
                Send USDC from your account onto one pass. The member keeps the
                pass and can pay or cash out later.
              </p>
              <Field id="fund-token" label="Membership">
                <MemberSelect
                  id="fund-token"
                  name="fund-token"
                  members={members}
                />
              </Field>
              <Field
                id="fund-amount"
                label="Amount"
                hint="5000 is 5,000.00 USDC."
              >
                <input
                  id="fund-amount"
                  name="fund-amount"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClass}
                  placeholder="5000"
                />
              </Field>
              <Button type="submit" disabled={pending}>
                Fund vault
              </Button>
            </form>
          ) : null}
          {valueView === "rewards" ? (
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                const amount = parseUsdc(
                  String(
                    new FormData(event.currentTarget).get("pool-amount") ?? "",
                  ),
                );
                void act(
                  () =>
                    send(
                      "ft_transfer_call",
                      {
                        receiver_id: CONTRACT_ID,
                        amount: amount.toString(),
                        memo: null,
                        msg: `rewards:${program.id}`,
                      },
                      {
                        receiverId: USDC_TOKEN,
                        deposit: ONE_YOCTO,
                        gas: MINT_GAS,
                      },
                    ),
                  "Reward pool funded.",
                  event,
                );
              }}
            >
              <p className="max-w-xl text-sm text-muted">
                Send USDC into the reward pool. You choose the pass and the
                amount when you pay a reward.
              </p>
              <Field
                id="pool-amount"
                label="Amount"
                hint="5000 is 5,000.00 USDC."
              >
                <input
                  id="pool-amount"
                  name="pool-amount"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClass}
                  placeholder="5000"
                />
              </Field>
              <Button type="submit" disabled={!mine || pending}>
                Fund reward pool
              </Button>
            </form>
          ) : null}
          {valueView === "pay" && members.length === 0 ? (
            <IssuePassFirst onIssue={() => setSection("issue")} />
          ) : null}
          {valueView === "pay" && members.length > 0 ? (
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                void act(
                  () =>
                    send(
                      "distribute_usdc_reward",
                      {
                        program_id: program.id,
                        token_id: String(data.get("reward-token")),
                        amount: parseUsdc(
                          String(data.get("reward-amount")),
                        ).toString(),
                      },
                      { gas: GAS },
                    ),
                  "Reward sent to the membership vault.",
                  event,
                );
              }}
            >
              <p className="max-w-xl text-sm text-muted">
                Move USDC from the reward pool onto one pass. You pick the
                membership and the amount.
              </p>
              <Field id="reward-token" label="Reward for">
                <MemberSelect
                  id="reward-token"
                  name="reward-token"
                  members={members}
                />
              </Field>
              <Field id="reward-amount" label="Amount">
                <input
                  id="reward-amount"
                  name="reward-amount"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClass}
                  placeholder="5000"
                />
              </Field>
              <Button type="submit" disabled={!mine || pending}>
                Pay reward
              </Button>
            </form>
          ) : null}
        </Panel>
      ) : null}
      {section === "points" ? (
        <Panel title="Points and revenue">
          <SectionNav
            label="Points and revenue"
            value={pointsView}
            onChange={setPointsView}
            options={[
              { id: "points", label: "Points" },
              { id: "revenue", label: "Revenue" },
            ]}
          />
          {pointsView === "points" && members.length === 0 ? (
            <IssuePassFirst
              detail="Points are awarded and revoked on a membership, so there is nothing to change until one exists."
              onIssue={() => setSection("issue")}
            />
          ) : null}
          {pointsView === "points" && members.length > 0 ? (
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                const points = Number(data.get("points"));
                const action = String(data.get("point-action"));
                void act(
                  () =>
                    send(
                      action === "revoke" ? "revoke_points" : "award_points",
                      {
                        token_id: String(data.get("point-token")),
                        points,
                        memo: String(data.get("memo") ?? "") || null,
                      },
                      { gas: GAS },
                    ),
                  action === "revoke" ? "Points revoked." : "Points awarded.",
                  event,
                );
              }}
            >
              <p className="max-w-xl text-sm text-muted">
                Award or revoke points on one pass. Awarded points also count as
                XP. Revoking takes both away.
              </p>
              <Field id="point-token" label="Membership">
                <MemberSelect
                  id="point-token"
                  name="point-token"
                  members={members}
                />
              </Field>
              <Field id="points" label="Points">
                <input
                  id="points"
                  name="points"
                  inputMode="numeric"
                  required
                  className={inputClass}
                  placeholder="100"
                />
              </Field>
              <Field id="memo" label="Memo">
                <input
                  id="memo"
                  name="memo"
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
              <input type="hidden" name="point-action" value="award" />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={!mine || pending}
                  onClick={(event) =>
                    setPointAction(event.currentTarget.form, "award")
                  }
                >
                  Award points
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!mine || pending}
                  onClick={(event) =>
                    setPointAction(event.currentTarget.form, "revoke")
                  }
                >
                  Revoke points
                </Button>
              </div>
            </form>
          ) : null}
          {pointsView === "revenue" ? (
            <div className="mt-4 space-y-4">
              <SectionNav
                label="Revenue"
                value={revenueView}
                onChange={setRevenueView}
                options={[
                  { id: "record", label: "Record" },
                  { id: "distribute", label: "Distribute" },
                ]}
              />
              {revenueView === "record" ? (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    const amount = parseUsdc(
                      String(
                        new FormData(event.currentTarget).get("revenue") ?? "",
                      ),
                    );
                    void act(
                      () =>
                        send(
                          "ft_transfer_call",
                          {
                            receiver_id: CONTRACT_ID,
                            amount: amount.toString(),
                            memo: null,
                            msg: `revenue:${program.id}`,
                          },
                          {
                            receiverId: USDC_TOKEN,
                            deposit: ONE_YOCTO,
                            gas: MINT_GAS,
                          },
                        ),
                      "Revenue recorded.",
                      event,
                    );
                  }}
                >
                  <p className="max-w-xl text-sm text-muted">
                    This USDC comes from your account, the same balance you
                    claim. It is not created by the programme. Recording it puts
                    it in the revenue pool.
                  </p>
                  <Field
                    id="revenue"
                    label="Amount"
                    hint="5000 is 5,000.00 USDC."
                  >
                    <input
                      id="revenue"
                      name="revenue"
                      inputMode="decimal"
                      required
                      autoComplete="off"
                      className={inputClass}
                      placeholder="5000"
                    />
                  </Field>
                  <Button type="submit" disabled={!mine || pending}>
                    Record revenue
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="max-w-xl text-sm text-muted">
                    Split the revenue pool by the percent on each tier. Passes
                    in a tier share that percent evenly, and the USDC lands on
                    each pass.
                  </p>
                  <Button
                    type="button"
                    disabled={!mine || pending}
                    onClick={() =>
                      void act(
                        () =>
                          send(
                            "distribute_usdc_revenue",
                            { program_id: program.id },
                            { gas: GAS },
                          ),
                        "Revenue distributed to the passes.",
                      )
                    }
                  >
                    Distribute revenue
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </Panel>
      ) : null}
      {section === "payment" ? <Charge /> : null}
    </div>
  );
}

function IssuePassFirst({
  detail = "Send value onto a membership after one exists.",
  onIssue,
}: {
  detail?: string;
  onIssue: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="max-w-xl text-sm text-muted">
        Issue a pass first. {detail}
      </p>
      <Button type="button" variant="secondary" onClick={onIssue}>
        Issue a pass
      </Button>
    </div>
  );
}

function Charge() {
  const { account } = useVeyra();
  const [amount, setAmount] = useState("");
  if (!account) return null;
  const payload = amount.trim() ? `veyra:pay:${account}:${amount.trim()}` : "";

  return (
    <Panel title="Request a payment">
      <p className="max-w-2xl text-sm text-muted">
        Show this code to a member of this programme. They scan it on their pass
        and confirm. The pass stays with them. The USDC leaves the pass and
        arrives in this account.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <Field
          id="charge-amount"
          label="Amount"
          hint="The member confirms, and this much USDC leaves their pass. 10 is 10.00 USDC."
        >
          <input
            id="charge-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="10.00"
            className={inputClass}
          />
        </Field>
        {payload ? (
          <PassCode
            value={payload}
            label={`Payment request for ${amount} USDC`}
          />
        ) : null}
      </div>
    </Panel>
  );
}

function backHref(params: { get: (key: string) => string | null }) {
  const page = Number(params.get("page") || "1");
  return page > 1 ? `/business?page=${page}` : "/business";
}

function setPointAction(
  form: HTMLFormElement | null,
  action: "award" | "revoke",
) {
  const hidden = form?.elements.namedItem("point-action");
  if (hidden instanceof HTMLInputElement) hidden.value = action;
}

function updateTier(
  setTiers: Dispatch<SetStateAction<typeof starterTiers>>,
  index: number,
  key: keyof (typeof starterTiers)[number],
  value: string,
) {
  setTiers((current) =>
    current.map((tier, tierIndex) =>
      tierIndex === index ? { ...tier, [key]: value } : tier,
    ),
  );
}
