import type { Metadata } from "next";
import { Suspense } from "react";
import { BusinessDashboard } from "@/components/business-dashboard";
import { LoadingState } from "@/components/ui";

export const metadata: Metadata = { title: "Business" };

export default function BusinessPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading programmes" />}>
      <BusinessDashboard />
    </Suspense>
  );
}
