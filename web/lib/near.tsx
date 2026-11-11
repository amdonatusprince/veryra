"use client";

import { Buffer } from "buffer";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { NearConnector } from "@hot-labs/near-connect";
import { CONTRACT_ID, NETWORK, RPC_URL } from "@/lib/config";
import { installNightlyRelay } from "@/lib/nightly";
import { panicText } from "@/lib/chain";

const target = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
target.Buffer ??= Buffer;

export type SendOptions = {
  gas?: string;
  deposit?: string;
  receiverId?: string;
};

export type ContractCall = {
  methodName: string;
  args: object;
  gas?: string;
  deposit?: string;
};

type NearState = {
  account: string | null;
  ready: boolean;
  pending: boolean;
  dialogOpen: boolean;
  error: string;
  openDialog: () => void;
  closeDialog: () => void;
  signIn: (choice: "passkey" | "near" | "evm" | "wallet") => Promise<void>;
  signOut: () => Promise<void>;
  send: (
    methodName: string,
    args: object,
    options?: SendOptions,
  ) => Promise<string>;
  sendCalls: (calls: ContractCall[], receiverId?: string) => Promise<string>;
};

const NearContext = createContext<NearState | null>(null);

const passkeyManifest = {
  id: "passkey",
  name: "Passkey",
  description: "Touch ID and Face ID",
  icon: "https://near.com/favicon.ico",
  website: "https://near.com",
  version: "1.0.0",
  executor:
    "https://raw.githubusercontent.com/NEAR-DevHub/near-connect-passkey/master/passkey-executor.js",
  type: "sandbox" as const,
  platform: ["browser"],
  permissions: { storage: true },
  features: {
    signMessage: true,
    signTransaction: true,
    signAndSendTransaction: true,
    signAndSendTransactions: true,
    signInWithoutAddKey: true,
    signInAndSignMessage: false,
    signInWithFunctionCallKey: false,
    signDelegateActions: true,
    mainnet: true,
    testnet: true,
  },
};

let connectorPromise: Promise<NearConnector> | null = null;

function connector() {
  connectorPromise ??= (async () => {
    const { NearConnector } = await import("@hot-labs/near-connect");
    const next = new NearConnector({
      network: NETWORK,
      providers: { testnet: [RPC_URL], mainnet: [RPC_URL] },
      footerBranding: {
        heading: "Veyra",
        link: "https://near.com",
        linkText: "near.com",
      },
    });
    await next.whenManifestLoaded.catch(() => undefined);
    await next.registerWallet(passkeyManifest).catch(() => undefined);
    return next;
  })();
  return connectorPromise;
}

function messageOf(caught: unknown) {
  const raw = caught instanceof Error ? caught.message : "Could not sign in";
  return panicText(raw) || raw;
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  work.then(
    () => clearTimeout(timer),
    () => clearTimeout(timer),
  );
  return Promise.race([work, timeout]);
}

export function NearProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    installNightlyRelay();
    let cancelled = false;
    let current: NearConnector | undefined;
    const onIn = (event: { accounts: { accountId: string }[] }) => {
      if (!cancelled) setAccount(event.accounts[0]?.accountId ?? null);
    };
    const onOut = () => {
      if (!cancelled) setAccount(null);
    };
    void (async () => {
      const next = await connector();
      current = next;
      next.on("wallet:signIn", onIn);
      next.on("wallet:signOut", onOut);
      const existing = await next.getConnectedWallet().catch(() => null);
      if (!cancelled) {
        setAccount(existing?.accounts[0]?.accountId ?? null);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      current?.off("wallet:signIn", onIn);
      current?.off("wallet:signOut", onOut);
    };
  }, []);

  const value = useMemo<NearState>(
    () => ({
      account,
      ready,
      pending,
      dialogOpen,
      error,
      openDialog: () => {
        setError("");
        setDialogOpen(true);
      },
      closeDialog: () => setDialogOpen(false),
      signIn: async (choice) => {
        setError("");
        setPending(true);
        try {
          const next = await connector();
          if (choice === "passkey") await next.connect({ walletId: "passkey" });
          else if (choice === "evm")
            await next.connect({ walletId: "ethereum-wallets" });
          else await next.connect();
          setDialogOpen(false);
        } catch (caught) {
          if (/reject|closed|dismiss/i.test(messageOf(caught))) return;
          setError(messageOf(caught));
        } finally {
          setPending(false);
        }
      },
      signOut: async () => {
        const next = await connector();
        await next.disconnect().catch(() => undefined);
        setAccount(null);
      },
      send: (methodName, args, options = {}) =>
        signCalls(
          [
            {
              methodName,
              args,
              gas: options.gas,
              deposit: options.deposit,
            },
          ],
          options.receiverId,
        ),
      sendCalls: signCalls,
    }),
    [account, ready, pending, dialogOpen, error],
  );

  return <NearContext.Provider value={value}>{children}</NearContext.Provider>;
}

async function signCalls(calls: ContractCall[], receiverId?: string) {
  if (!CONTRACT_ID) throw new Error("NEAR_CONTRACT_ID is not set");
  if (calls.length === 0) throw new Error("Nothing to send");
  installNightlyRelay();
  const next = await connector();
  let wallet: Awaited<ReturnType<NearConnector["wallet"]>>;
  try {
    wallet = await next.wallet();
  } catch {
    throw new Error("Sign in before sending a transaction");
  }
  const result = await withTimeout(
    wallet.signAndSendTransaction({
      receiverId: receiverId || CONTRACT_ID,
      actions: calls.map((call) => ({
        type: "FunctionCall" as const,
        params: {
          methodName: call.methodName,
          args: call.args,
          gas: call.gas ?? "100000000000000",
          deposit: call.deposit ?? "0",
        },
      })),
    }),
    120_000,
    "The wallet did not finish sending. Approve the transaction again.",
  );
  return result.transaction?.hash ?? "";
}

export function useNear() {
  const value = useContext(NearContext);
  if (!value) throw new Error("useNear must be used inside NearProvider");
  return value;
}
