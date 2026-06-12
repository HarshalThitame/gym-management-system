"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function SuperAdminUserDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="rounded-full bg-red-100 p-4">
        <svg aria-hidden="true" className="size-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-black">Failed to load user details</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="primary">Try Again</Button>
        <ButtonLink href="/super-admin/users" variant="secondary">Back to Users</ButtonLink>
      </div>
    </div>
  );
}
