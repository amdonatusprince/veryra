"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiArrowRightSLine,
} from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { MembershipCard } from "@/components/membership-card";
import { PassArt } from "@/components/pass-art";
import { PassCode } from "@/components/pass-code";
import { useVeyra } from "@/components/providers";
import { Field, Notice, Panel, inputClass, useAction } from "@/components/ui";
import { GAS, ONE_YOCTO, USDC_TOKEN } from "@/lib/config";
import { artworkSrc } from "@/lib/artwork";
import { formatPoints, formatUsdc, parseUsdc } from "@/lib/format";
import { parsePayCode } from "@/lib/pay";

const pageSize = 4;

function listHref(params: { get: (name: string) => string | null }) {
  const page = Number(params.get("page") || "1");
  return page > 1 ? `/member?page=${page}` : "/member";
}

export function MemberDashboard() {
  const { account } = useVeyra();
  const params = useSearchParams();
  const tokenId = params.get("pass");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">Member</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-foreground">
          {tokenId ? "Your membership" : "Your passes"}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          {tokenId
            ? "The card, the vault, and the access rights belong to the NFT. Transfer it and the next owner takes them."
            : "Every pass this account holds. Open one to pay, transfer, or cash out."}
          {account ? ` Signed in as ${account}.` : ""}
        </p>
      </div>
      {tokenId ? <MemberDetail tokenId={tokenId} /> : <PassList />}
    </div>
  );
}

function PassList() {
  const { account, registry, loading, loadError, refresh, openDialog } =
    useVeyra();
  const router = useRouter();
  const params = useSearchParams();
  const held = account
    ? registry.memberships.filter((item) => item.owner_id === account)
    : [];
  const pageCount = Math.max(1, Math.ceil(held.length / pageSize));
  const requested = Number(params.get("page") || "1");
  const page = Number.isFinite(requested)
    ? Math.min(pageCount, Math.max(1, requested))
    : 1;
  const visible = held.slice((page - 1) * pageSize, page * pageSize);

  function openPage(next: number) {
    router.push(next <= 1 ? "/member" : `/member?page=${next}`);
  }

  if (!account) {
    return (
      <Panel title="Your passes">
        <p className="text-sm text-muted">
          The membership list comes from the contract. Sign in with the account
          that owns the NFT.
        </p>
        <Button type="button" className="mt-4" onClick={openDialog}>
          Sign in
        </Button>
      </Panel>
    );
  }

  if (loading && held.length === 0) {
    return (
      <Panel title="Your passes">
        <div className="space-y-3" aria-busy="true">
          <p className="text-sm text-muted">Reading passes for {account}.</p>
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl border border-line bg-background"
            />
          ))}
        </div>
      </Panel>
    );
  }

  if (loadError && held.length === 0) {
    return (
      <Panel title="Your passes">
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

  if (held.length === 0) {
    return (
      <Panel title="Your passes">
        <p className="text-sm text-muted">
          {account} does not hold a pass yet. Issue one from the business
          dashboard.
        </p>
        <ButtonLink
          href="/business"
          trailingIcon={RiArrowRightLine}
          className="mt-4"
        >
          Open the business dashboard
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <Panel title="Your passes">
      <ul className="space-y-3">
        {visible.map((membership) => {
          const symbol =
            registry.programs.find(
              (program) => program.id === membership.program_id,
            )?.symbol ?? "";
          return (
            <li key={membership.token_id}>
              <div className="flex min-h-20 items-center gap-3 rounded-2lg border border-border-button-default bg-background-primary-default p-3">
                <PassArt
                  expandable
                  alt={`${membership.program_name} pass`}
                  media={artworkSrc({
                    name: membership.program_name,
                    symbol,
                    color: membership.color,
                    media: membership.media,
                  })}
                  seed={membership.program_id}
                  className="h-16 w-16 shrink-0 rounded-xl"
                />
                <button
                  type="button"
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  onClick={() =>
                    router.push(
                      `/member?pass=${encodeURIComponent(membership.token_id)}${page > 1 ? `&page=${page}` : ""}`,
                    )
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-medium text-text-primary">
                      {membership.program_name}
                    </span>
                    <span className="mt-1 block text-caption-1-regular text-text-secondary">
                      {membership.tier_name} · {membership.token_id}
                      {membership.paused ? " · paused" : ""} ·{" "}
                      {formatUsdc(membership.usdc_vault || "0")} ·{" "}
                      {formatPoints(membership.points)} points
                    </span>
                  </span>
                  <RiArrowRightSLine
                    className="size-5 shrink-0 text-foreground-icon-tertiary"
                    aria-hidden
                  />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <nav
        aria-label="Pass pages"
        className="mt-4 flex items-center justify-between gap-3"
      >
        <Button
          type="button"
          variant="secondary"
          leadingIcon={RiArrowLeftLine}
          disabled={page <= 1}
          onClick={() => openPage(page - 1)}
        >
          Previous
        </Button>
        <p className="text-sm tabular-nums text-muted">
          Page {page} of {pageCount}
        </p>
        <Button
          type="button"
          variant="secondary"
          trailingIcon={RiArrowRightLine}
          disabled={page >= pageCount}
          onClick={() => openPage(page + 1)}
        >
          Next
        </Button>
      </nav>
    </Panel>
  );
}

function MemberDetail({ tokenId }: { tokenId: string }) {
  const { account, registry, loading, send, openDialog } = useVeyra();
  const router = useRouter();
  const params = useSearchParams();
  const current = account
    ? registry.memberships.find(
        (item) => item.token_id === tokenId && item.owner_id === account,
      )
    : undefined;
  const { act, error, status, pending } = useAction();

  if (!account) {
    return (
      <Panel title="Your membership">
        <p className="text-sm text-muted">
          Sign in with the account that owns this pass to pay, transfer, or cash
          out.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={openDialog}>
            Sign in
          </Button>
          <Button
            type="button"
            variant="secondary"
            leadingIcon={RiArrowLeftLine}
            onClick={() => router.push(listHref(params))}
          >
            All passes
          </Button>
        </div>
      </Panel>
    );
  }

  if (!current) {
    return (
      <Panel title="Your membership">
        <p className="text-sm text-muted">
          {loading
            ? "Reading this pass from the contract."
            : "This account does not hold that pass."}
        </p>
        <Button
          type="button"
          variant="secondary"
          leadingIcon={RiArrowLeftLine}
          className="mt-4"
          onClick={() => router.push(listHref(params))}
        >
          All passes
        </Button>
      </Panel>
    );
  }

  const rights = current.access_rights.length
    ? current.access_rights.join(", ")
    : "None on this tier";

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="secondary"
        leadingIcon={RiArrowLeftLine}
        onClick={() => router.push(listHref(params))}
      >
        All passes
      </Button>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <MembershipCard membership={current} />
          <div className="flex items-center gap-4">
            <PassCode
              value={current.bound_account}
              label={`Pass ${current.bound_account}`}
            />
            <p className="text-sm text-muted">
              This code is the pass address. Someone can look it up in the
              explorer.
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <Panel title="Account">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Bound account</dt>
                <dd className="mt-1 break-all text-foreground">
                  {current.bound_account}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Controller</dt>
                <dd className="mt-1 break-all text-foreground">
                  {current.owner_id}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Access</dt>
                <dd className="mt-1 text-foreground">
                  {current.paused ? "Programme paused" : rights}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Next tier</dt>
                <dd className="mt-1 text-foreground">
                  {current.xp_to_next === null
                    ? "Highest tier"
                    : `${current.xp_to_next} XP`}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <Notice error={error} status={status} />
            </div>
          </Panel>
          <PayPanel
            tokenId={current.token_id}
            vault={current.usdc_vault || "0"}
          />
          <Panel title="Transfer">
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                const receiver = String(
                  new FormData(event.currentTarget).get("receiver") ?? "",
                );
                void act(
                  () =>
                    send(
                      "transfer_membership",
                      {
                        receiver_id: receiver,
                        token_id: current.token_id,
                        memo: "transfer",
                      },
                      { deposit: ONE_YOCTO, gas: GAS },
                    ),
                  `Transferred ${current.token_id} to ${receiver}.`,
                  event,
                );
              }}
            >
              <Field
                id="transfer-receiver"
                label="New owner *"
                hint="They receive the vault, the tier, and the access rights."
              >
                <input
                  id="transfer-receiver"
                  name="receiver"
                  required
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
              <Button type="submit" disabled={pending}>
                Transfer membership
              </Button>
            </form>
          </Panel>
          <Panel title="Gift points">
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                const points = Number(data.get("gift-points"));
                void act(
                  () =>
                    send(
                      "gift_points",
                      {
                        from_token_id: current.token_id,
                        to_token_id: String(data.get("gift-token")),
                        points,
                        memo: "gift",
                      },
                      { gas: GAS },
                    ),
                  "Points gifted. XP stays on this membership.",
                  event,
                );
              }}
            >
              <Field
                id="gift-token"
                label="Recipient membership"
                hint="Same programme. Points move. XP does not."
              >
                <input
                  id="gift-token"
                  name="gift-token"
                  required
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
              <Field id="gift-points" label="Points">
                <input
                  id="gift-points"
                  name="gift-points"
                  required
                  inputMode="numeric"
                  className={inputClass}
                  placeholder="20"
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                disabled={pending || current.points === 0}
              >
                Gift points
              </Button>
            </form>
          </Panel>
          <Panel title="Withdraw">
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                const raw = String(
                  new FormData(event.currentTarget).get("withdraw-amount") ??
                    "",
                );
                void act(
                  async () => {
                    const amount = parseUsdc(raw);
                    await send(
                      "cash_out",
                      { token_id: current.token_id, amount: amount.toString() },
                      { deposit: ONE_YOCTO, gas: GAS },
                    );
                  },
                  "USDC sent to the current owner.",
                  event,
                );
              }}
            >
              <Field
                id="withdraw-amount"
                label="Amount"
                hint={`Available ${formatUsdc(current.usdc_vault || "0")}.`}
              >
                <input
                  id="withdraw-amount"
                  name="withdraw-amount"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClass}
                  placeholder="1"
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                disabled={
                  pending || !current.usdc_vault || current.usdc_vault === "0"
                }
              >
                Cash out
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PayPanel({ tokenId, vault }: { tokenId: string; vault: string }) {
  const { send } = useVeyra();
  const { act, error, status, pending } = useAction();
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!scanning) return;
    let stop = false;
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    async function watch() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!video || stop) return;
        video.srcObject = stream;
        await video.play();
        const Detector = (
          window as unknown as { BarcodeDetector?: ScanDetector }
        ).BarcodeDetector;
        if (!Detector)
          throw new Error(
            "This browser cannot scan a code. Paste the payment code instead.",
          );
        const detector = new Detector({ formats: ["qr_code"] });
        while (!stop) {
          const codes = await detector.detect(video);
          const parsed = parsePayCode(codes[0]?.rawValue ?? "");
          if (parsed) {
            setReceiver(parsed.receiver);
            setAmount(parsed.amount);
            setScanError("");
            setScanning(false);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } catch (caught) {
        if (!stop)
          setScanError(
            caught instanceof Error
              ? caught.message
              : "The camera could not be opened.",
          );
        setScanning(false);
      } finally {
        stream?.getTracks().forEach((track) => track.stop());
      }
    }
    void watch();
    return () => {
      stop = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning]);

  return (
    <Panel title="Pay with this pass">
      <p className="text-sm text-muted">
        Scan the business payment code, or enter who you are paying. Confirming
        sends that much USDC from this pass. The pass stays with you.
      </p>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          const raw = amount;
          const to = receiver;
          void act(
            async () => {
              const value = parseUsdc(raw);
              await send(
                "pay",
                {
                  token_id: tokenId,
                  receiver_id: to,
                  amount: value.toString(),
                },
                { deposit: ONE_YOCTO, gas: GAS },
              );
            },
            `Paid ${raw} USDC to ${to}.`,
            event,
          );
        }}
      >
        <Field
          id="pay-receiver"
          label="Pay to *"
          hint="The account that receives the USDC. Paste a payment code here too."
        >
          <input
            id="pay-receiver"
            required
            autoComplete="off"
            placeholder="account.near"
            value={receiver}
            onChange={(event) => {
              const parsed = parsePayCode(event.target.value);
              if (parsed) {
                setReceiver(parsed.receiver);
                setAmount(parsed.amount);
                return;
              }
              setReceiver(event.target.value);
            }}
            className={inputClass}
          />
        </Field>
        <Field
          id="pay-amount"
          label="Amount"
          hint={`Available ${formatUsdc(vault || "0")}.`}
        >
          <input
            id="pay-amount"
            required
            inputMode="decimal"
            placeholder="10.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={pending || !vault || vault === "0" || !USDC_TOKEN}
          >
            Pay
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setScanError("");
              setScanning((current) => !current);
            }}
          >
            {scanning ? "Stop scanning" : "Scan a code"}
          </Button>
        </div>
        {scanning ? (
          <video
            ref={videoRef}
            muted
            playsInline
            className="max-h-64 w-full rounded-md bg-background object-cover"
          />
        ) : null}
        {scanError ? <p className="text-sm text-danger">{scanError}</p> : null}
        <Notice error={error} status={status} />
      </form>
    </Panel>
  );
}

type ScanDetector = new (options: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
