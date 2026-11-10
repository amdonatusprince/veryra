import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberDashboard } from "@/components/member-dashboard";
import { LoadingState } from "@/components/ui";

export const metadata: Metadata = { title: "Member" };

export default function MemberPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading passes" />}>
      <MemberDashboard />
    </Suspense>
  );
}
