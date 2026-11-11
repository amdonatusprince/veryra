import { RPC_URL } from "@/lib/config";

type SignedTransaction = { encode?: () => Uint8Array };

type NightlyNear = {
  signTransaction: (transaction: unknown, send?: boolean) => Promise<unknown>;
  __veyra?: boolean;
};

type Outcome = {
  transaction?: { hash?: string };
  status?: { Failure?: unknown };
};

/** Nightly's own broadcast uses nodes that reject `send_tx`. Sign locally, then broadcast on the app RPC. */
export function installNightlyRelay() {
  const near = (window as Window & { nightly?: { near?: NightlyNear } }).nightly
    ?.near;
  if (!near || near.__veyra) return;
  const original = near.signTransaction.bind(near);
  near.signTransaction = async (transaction, send) => {
    const signed = (await original(transaction, false)) as SignedTransaction;
    if (!send) return signed;
    return broadcast(signed);
  };
  near.__veyra = true;
}

async function broadcast(signed: SignedTransaction) {
  if (typeof signed.encode !== "function")
    throw new Error("Nightly did not return a signed transaction");
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "veyra",
      method: "send_tx",
      params: {
        signed_tx_base64: base64(signed.encode()),
        wait_until: "EXECUTED",
      },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; data?: unknown };
    result?: Outcome;
  };
  if (body.error || !body.result) {
    const data = body.error?.data;
    throw new Error(
      (typeof data === "string" ? data : body.error?.message) ||
        "The transaction was rejected",
    );
  }
  if (body.result.status && "Failure" in body.result.status) {
    throw new Error(JSON.stringify(body.result.status.Failure));
  }
  return body.result;
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
