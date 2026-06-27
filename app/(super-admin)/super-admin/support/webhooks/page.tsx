import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { WebhooksClient } from "./webhooks-client";

async function WebhooksContent() {
  await requireRole(["super_admin"], "/super-admin");
  return <WebhooksClient />;
}

export default function WebhooksPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <WebhooksContent />
    </Suspense>
  );
}
