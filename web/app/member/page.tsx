import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberDashboard } from "@/components/member-dashboard";

export const metadata: Metadata = { title: "Member" };

export default function MemberPage() {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" />
      }
    >
      <MemberDashboard />
    </Suspense>
  );
}
