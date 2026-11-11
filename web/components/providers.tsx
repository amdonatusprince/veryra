"use client";

import { SignInDialog } from "@/components/sign-in-dialog";
import {
  emptyRegistry,
  loadRegistry,
  panicText,
  type Registry,
} from "@/lib/chain";
import { ToastProvider } from "@/components/toast";
import {
  NearProvider,
  useNear,
  type ContractCall,
  type SendOptions,
} from "@/lib/near";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

type Snapshot = { registry: Registry; loading: boolean; loadError: string };

let snapshot: Snapshot = {
  registry: emptyRegistry,
  loading: true,
  loadError: "",
};
const listeners = new Set<() => void>();
let request = 0;

function emit(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function refreshRegistry() {
  const id = ++request;
  emit({ ...snapshot, loading: true });
  return loadRegistry()
    .then((registry) => {
      if (id === request) emit({ registry, loading: false, loadError: "" });
    })
    .catch((caught: unknown) => {
      if (id !== request) return;
      emit({
        registry: snapshot.registry,
        loading: false,
        loadError:
          caught instanceof Error
            ? caught.message
            : "Could not read the contract",
      });
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (request === 0) void refreshRegistry();
  return () => listeners.delete(listener);
}

type VeyraContextValue = {
  account: string | null;
  ready: boolean;
  loading: boolean;
  loadError: string;
  registry: Registry;
  refresh: () => Promise<void>;
  send: (
    method: string,
    args: object,
    options?: SendOptions,
  ) => Promise<string>;
  sendCalls: (calls: ContractCall[], receiverId?: string) => Promise<string>;
  openDialog: () => void;
  signOut: () => Promise<void>;
};

const VeyraContext = createContext<VeyraContextValue | null>(null);

function RegistryProvider({ children }: { children: React.ReactNode }) {
  const near = useNear();
  const { registry, loading, loadError } = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
  const refresh = useCallback(() => refreshRegistry(), []);

  const sendCalls = useCallback(
    async (calls: ContractCall[], receiverId?: string) => {
      if (!near.account) {
        near.openDialog();
        throw new Error("Sign in before sending a transaction");
      }
      try {
        const hash = await near.sendCalls(calls, receiverId);
        await refresh();
        return hash;
      } catch (caught) {
        const message = panicText(
          caught instanceof Error ? caught.message : String(caught),
        );
        throw new Error(
          message ||
            (caught instanceof Error
              ? caught.message
              : "The transaction failed"),
        );
      }
    },
    [near, refresh],
  );

  const send = useCallback(
    (method: string, args: object, options?: SendOptions) =>
      sendCalls(
        [
          {
            methodName: method,
            args,
            gas: options?.gas,
            deposit: options?.deposit,
          },
        ],
        options?.receiverId,
      ),
    [sendCalls],
  );

  const value = useMemo<VeyraContextValue>(
    () => ({
      account: near.account,
      ready: near.ready,
      loading,
      loadError,
      registry,
      refresh,
      send,
      sendCalls,
      openDialog: near.openDialog,
      signOut: near.signOut,
    }),
    [near, loading, loadError, registry, refresh, send, sendCalls],
  );

  return (
    <VeyraContext.Provider value={value}>
      <ToastProvider>
        {children}
        <SignInDialog />
      </ToastProvider>
    </VeyraContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NearProvider>
      <RegistryProvider>{children}</RegistryProvider>
    </NearProvider>
  );
}

export function useVeyra() {
  const value = useContext(VeyraContext);
  if (!value) throw new Error("useVeyra must be used inside Providers");
  return value;
}
