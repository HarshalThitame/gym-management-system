"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";

export function DeletePaymentMethodButton({ methodId }: { methodId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this payment method?")) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/billing/member-payment-methods?methodId=${methodId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        showToast("Failed to remove payment method", "error");
        return;
      }

      showToast("Payment method removed", "success");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex size-8 items-center justify-center rounded-md text-slate hover:bg-white/10 hover:text-red-400 transition-colors"
      title="Remove payment method"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
