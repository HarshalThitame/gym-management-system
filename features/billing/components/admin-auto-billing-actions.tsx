"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";

export function AdminAutoBillingActions({
  memberId,
  membershipId,
  autoRenew,
  hasActiveSubscription,
  subscriptionId,
}: {
  memberId: string;
  membershipId: string;
  autoRenew: boolean;
  hasActiveSubscription: boolean;
  subscriptionId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisable() {
    if (!confirm("Disable auto-renew for this member? This will cancel any active subscription.")) return;
    setLoading(true);

    try {
      const res = await fetch("/api/billing/admin/member-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", memberId, membershipId, subscriptionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Action failed", "error");
        return;
      }

      showToast("Auto-renew disabled", "success");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!autoRenew) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-2">
      {hasActiveSubscription ? (
        <span className="text-xs font-semibold text-emerald-600">Active</span>
      ) : null}
      <Button size="sm" variant="ghost" onClick={handleDisable} disabled={loading} className="text-xs text-red-500 hover:text-red-700">
        {loading ? <Loader2 className="size-3 animate-spin" /> : "Disable"}
      </Button>
    </div>
  );
}
