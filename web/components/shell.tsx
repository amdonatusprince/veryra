"use client";

import { Button } from "@/components/base/buttons/button";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { useVeyra } from "@/components/providers";
import { shortAccount } from "@/lib/format";
import { cx } from "@/utils/cx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/overview", label: "Overview", detail: "Public ledger" },
  { href: "/business", label: "Business", detail: "Create and issue" },
  { href: "/member", label: "Member", detail: "Your passes" },
  { href: "/explorer", label: "Explorer", detail: "Find a pass" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { account, ready, loadError, openDialog, signOut } = useVeyra();
  const visible = account
    ? links
    : links.filter((link) => link.href === "/overview");

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-20 focus:rounded-lg bg-background-primary-default px-3 py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-separator-border bg-background-primary-default">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-10 shrink-0 items-baseline gap-3"
          >
            <span className="text-title-2-medium text-text-primary">Veyra</span>
            <span className="hidden text-caption-1-regular text-text-secondary sm:inline">
              Programmable ownership
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle appearance="segmented" size="small" />
            {account ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void signOut()}
                className="max-w-44"
              >
                <span className="truncate">{shortAccount(account)}</span>
              </Button>
            ) : (
              <Button type="button" onClick={openDialog} disabled={!ready}>
                Sign in
              </Button>
            )}
          </div>
        </div>
        <nav
          aria-label="Primary"
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 md:px-6 lg:px-8"
        >
          {visible.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-12 min-w-36 shrink-0 flex-col justify-center rounded-2lg px-3 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                  active
                    ? "bg-accent-50 text-text-primary"
                    : "text-text-secondary hover:bg-background-secondary-default",
                )}
              >
                <span className="text-body-medium text-text-primary">
                  {link.label}
                </span>
                <span className="text-caption-1-regular text-text-secondary">
                  {link.detail}
                </span>
              </Link>
            );
          })}
        </nav>
      </header>
      {loadError ? (
        <p
          role="alert"
          className="mx-auto max-w-7xl px-4 py-3 text-body-regular text-text-error-primary md:px-6 lg:px-8"
        >
          {loadError}
        </p>
      ) : null}
      <main
        id="content"
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 md:px-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}
