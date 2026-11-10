"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

type Tone = "ok" | "err";

type Item = {
  id: number;
  tone: Tone;
  text: string;
};

type ToastApi = {
  push: (text: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = nextId.current;
    nextId.current += 1;
    setItems((current) => [...current.slice(-3), { id, tone, text }]);
  }, []);

  return (
    <ToastContext.Provider value={useMemo(() => ({ push }), [push])}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[70] flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: Item;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), 6000);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      role={item.tone === "err" ? "alert" : "status"}
      className={cx(
        "veyra-toast pointer-events-auto flex items-start gap-3 border-2 border-text-primary bg-background-primary-default p-3",
        item.tone === "err"
          ? "border-s-4 border-s-border-error-default"
          : "border-s-4 border-s-accent-600",
      )}
    >
      <p className="min-w-0 flex-1 pt-2 text-body-regular text-text-primary">
        {item.text}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="small"
        onClick={() => onDismiss(item.id)}
      >
        Dismiss
      </Button>
    </div>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
