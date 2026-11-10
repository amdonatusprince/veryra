"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PassArt } from "@/components/pass-art";
import { useVeyra } from "@/components/providers";
import { Button } from "@/components/base/buttons/button";
import { Panel } from "@/components/ui";
import { artworkSrc } from "@/lib/artwork";
import { viewCall, type ProgramView } from "@/lib/chain";
import { GAS, STORAGE_DEPOSIT } from "@/lib/config";

export default function ClaimPage() {
  const params = useParams<{ id: string }>();
  const claimId = params.id;
  const { send, account } = useVeyra();
  const [claim, setClaim] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [program, setProgram] = useState<ProgramView | null>(null);

  useEffect(() => {
    let stop = false;
    viewCall<string | null>("get_claim", { claim_id: claimId })
      .then((found) => {
        if (!stop) setClaim(found);
      })
      .catch((caught: unknown) => {
        if (!stop)
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not read the claim",
          );
      });
    return () => {
      stop = true;
    };
  }, [claimId]);

  const parts = claim ? claim.split("|") : [];
  const programName = parts[2] || "Membership";
  const programId = parts[1] || "";

  useEffect(() => {
    if (!programId) return;
    let stop = false;
    viewCall<ProgramView>("get_program", { program_id: programId })
      .then((program) => {
        if (stop || !program) return;
        setProgram(program);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [programId]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mx-auto w-full max-w-md space-y-6 text-center">
        {claim === undefined ? (
          <p className="text-body-regular text-text-secondary">
            Reading the claim.
          </p>
        ) : null}
        {claim === null ? (
          <div>
            <h1 className="text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-text-primary">
              Claim closed
            </h1>
            <p className="mt-2 text-body-regular text-text-secondary">
              This link is not open. If someone already claimed it, the pass is
              with that account.
            </p>
          </div>
        ) : null}
        {claim ? (
          <>
            <div>
              <p className="text-caption-1-regular text-text-secondary">
                Claim
              </p>
              <h1 className="mt-1 text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-text-primary">
                Claim your pass
              </h1>
            </div>
            <Panel title={programName}>
              <PassArt
                expandable
                alt={`${programName} artwork`}
                media={artworkSrc({
                  name: programName,
                  symbol: program?.symbol,
                  color: program?.color,
                  media: program?.media,
                })}
                seed={parts[1] || claimId}
                className="mb-4 h-44 w-full rounded-2lg"
              />
              <p className="text-start text-body-regular text-text-secondary">
                Sign in and claim. The pass is minted to your account, and the
                code the business showed is cleared.
              </p>
              {account ? (
                <p className="mt-2 text-start text-body-regular text-text-primary">
                  Claiming as {account}
                </p>
              ) : null}
              <Button
                type="button"
                className="mt-4"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  setError("");
                  send(
                    "claim_membership",
                    { claim_id: claimId },
                    { deposit: STORAGE_DEPOSIT, gas: GAS },
                  )
                    .then(() => setClaim(null))
                    .catch((caught: unknown) =>
                      setError(
                        caught instanceof Error
                          ? caught.message
                          : "The claim failed",
                      ),
                    )
                    .finally(() => setPending(false));
                }}
              >
                {pending ? "Claiming…" : "Claim pass"}
              </Button>
              {error ? (
                <p className="mt-3 text-start text-body-regular text-text-error-primary">
                  {error}
                </p>
              ) : null}
            </Panel>
          </>
        ) : null}
        {error && claim === undefined ? (
          <p className="text-body-regular text-text-error-primary">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
