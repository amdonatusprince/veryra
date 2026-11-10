"use client";

import { useState } from "react";
import {
  RiArrowDownSLine,
  RiFileCopyLine,
  RiLogoutBoxRLine,
} from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { useVeyra } from "@/components/providers";
import { useToast } from "@/components/toast";
import { shortAccount } from "@/lib/format";
import { cx } from "@/utils/cx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/business", label: "Business" },
  { href: "/member", label: "Member" },
  { href: "/explorer", label: "Explorer" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { account, ready, loadError, openDialog, signOut } = useVeyra();
  const toast = useToast();
  const visible = account
    ? links
    : links.filter((link) => link.href === "/overview");
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-background-primary-default">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:border-2 focus:border-text-primary focus:bg-accent-400 focus:px-4 focus:py-3"
      >
        Skip to content
      </a>
      <header className="relative border-b border-text-primary bg-background-primary-default">
        <div className="mx-auto flex h-[88px] w-full max-w-[1320px] items-center gap-6 px-5 md:gap-10 md:px-10">
          <Link
            href="/"
            className="shrink-0 text-[26px] leading-none font-black tracking-[-0.055em] text-text-primary no-underline"
          >
            Veyra
          </Link>
          <nav
            id="main-nav"
            aria-label="Primary"
            className={cx(
              "items-center gap-7",
              open
                ? "absolute inset-x-0 top-[88px] z-20 flex flex-col items-start border-b-2 border-text-primary bg-background-primary-default px-5 py-4 md:static md:flex-row md:border-0 md:bg-transparent md:p-0"
                : "hidden md:flex",
            )}
          >
            {visible.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "border-b-2 py-3 text-[15px] font-medium text-text-primary no-underline",
                    active ? "border-accent-400" : "border-transparent",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle appearance="segmented" size="small" />
            {account ? (
              <PopoverTrigger
                isOpen={accountOpen}
                onOpenChange={setAccountOpen}
              >
                <Button
                  type="button"
                  trailingIcon={RiArrowDownSLine}
                  className="max-w-[220px]"
                  aria-label={`Account ${account}`}
                >
                  <span className="truncate">{shortAccount(account)}</span>
                </Button>
                <Popover
                  aria-label="Account"
                  placement="bottom end"
                  containerPadding={12}
                  className="!w-56 !rounded-none !border-2 !border-text-primary !p-0 !shadow-none"
                  dialogClassName="!gap-0 !p-0"
                >
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 px-4 text-start text-[15px] font-medium text-text-primary outline-none hover:bg-accent-50 focus-visible:bg-accent-50"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(account)
                        .then(() => toast.push("Address copied."))
                        .catch(() =>
                          toast.push("Could not copy the address.", "err"),
                        );
                      setAccountOpen(false);
                    }}
                  >
                    <RiFileCopyLine className="size-5 shrink-0" aria-hidden />
                    Copy address
                  </button>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 border-t border-text-primary px-4 text-start text-[15px] font-medium text-text-primary outline-none hover:bg-accent-50 focus-visible:bg-accent-50"
                    onClick={() => {
                      setAccountOpen(false);
                      void signOut();
                    }}
                  >
                    <RiLogoutBoxRLine className="size-5 shrink-0" aria-hidden />
                    Sign out
                  </button>
                </Popover>
              </PopoverTrigger>
            ) : (
              <Button type="button" onClick={openDialog} disabled={!ready}>
                Sign in
              </Button>
            )}
            <button
              type="button"
              className="h-11 border border-text-primary bg-background-primary-default px-3 text-[13px] font-bold md:hidden"
              aria-expanded={open}
              aria-controls="main-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      {loadError ? (
        <p
          role="alert"
          className="flex items-center justify-between gap-4 border-b border-text-primary bg-accent-50 px-5 py-3 text-sm text-text-primary md:px-10"
        >
          {loadError}
        </p>
      ) : null}
      <main
        id="content"
        className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-5 py-16 md:px-10"
      >
        {children}
      </main>
      <footer className="border-t border-text-primary">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <p className="text-[26px] leading-none font-black tracking-[-0.055em]">
              Veyra
            </p>
            <p className="mt-3 max-w-sm text-[13px] text-text-secondary">
              Assets that own, earn, interact and evolve.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {visible.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-2 text-[12px] font-semibold text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
