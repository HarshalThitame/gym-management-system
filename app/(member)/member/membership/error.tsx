"use client";

import { MemberErrorBoundary } from "@/features/member/components/member-error-boundary";

export default function MembershipError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <MemberErrorBoundary error={error} reset={reset} featureName="Membership" />;
}
