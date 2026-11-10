"use client";

import { useState } from "react";
import { RiArrowDownSLine } from "@remixicon/react";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { inputClass } from "@/components/ui";
import { passCode } from "@/lib/format";

export type MemberOption = {
  token_id: string;
  owner_id: string;
  tier_name: string;
};

export function MemberSelect({
  id,
  name,
  members,
}: {
  id: string;
  name: string;
  members: MemberOption[];
}) {
  const [token, setToken] = useState(members[0]?.token_id ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = members.find((member) => member.token_id === token);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? members.filter((member) =>
        `${passCode(member.token_id)} ${member.token_id} ${member.owner_id} ${member.tier_name}`
          .toLowerCase()
          .includes(needle),
      )
    : members;

  return (
    <div>
      <input type="hidden" name={name} value={token} />
      <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
        <button
          id={id}
          type="button"
          className={`${inputClass} flex items-center justify-between gap-3 text-start`}
        >
          <span className="min-w-0 truncate">
            {selected
              ? `${passCode(selected.token_id)} · ${selected.owner_id}`
              : "Choose a pass"}
          </span>
          <RiArrowDownSLine className="size-5 shrink-0" aria-hidden />
        </button>
        <Popover
          aria-label="Membership passes"
          placement="bottom start"
          containerPadding={12}
          offset={6}
          className="!w-(--trigger-width) !max-w-[calc(100vw-1.5rem)] !rounded-none !border-2 !border-dashed !border-text-primary !bg-background-primary-default !p-0 !opacity-100 !shadow-none"
          dialogClassName="!gap-0 !bg-background-primary-default !p-0"
        >
          <div className="bg-background-primary-default">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by code or account"
              aria-label="Search passes"
              className="min-h-12 w-full border-b border-dashed border-text-primary bg-transparent px-4 text-body-regular text-text-primary outline-none placeholder:text-text-tertiary"
            />
            <ul className="max-h-[min(240px,calc(100dvh-8rem))] overflow-auto py-1">
              {visible.length === 0 ? (
                <li className="px-4 py-3 text-body-regular text-text-secondary">
                  No matching pass.
                </li>
              ) : (
                visible.map((member) => (
                  <li key={member.token_id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-start outline-none hover:bg-accent-50 focus-visible:bg-accent-50"
                      onClick={() => {
                        setToken(member.token_id);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium tracking-wide text-text-primary">
                          {passCode(member.token_id)}
                        </span>
                        <span className="block truncate text-caption-1-regular text-text-secondary">
                          {member.owner_id}
                        </span>
                      </span>
                      <span className="shrink-0 text-caption-1-regular text-text-secondary">
                        {member.tier_name}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Popover>
      </PopoverTrigger>
    </div>
  );
}
