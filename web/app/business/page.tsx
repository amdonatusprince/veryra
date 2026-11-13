import type { Metadata } from "next";
import { Suspense } from "react";
import { BusinessDashboard } from "@/components/business-dashboard";

export const metadata: Metadata = { title: "Business" };

export default function BusinessPage() {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" />
      }
    >
      <BusinessDashboard />
    </Suspense>
  );
}
