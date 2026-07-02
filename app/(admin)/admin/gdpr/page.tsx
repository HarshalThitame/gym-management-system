import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { GdprDashboard } from "@/features/gdpr/components/gdpr-dashboard";

export const metadata: Metadata = {
  title: "GDPR Compliance",
  description: "Manage data protection compliance, deletion requests, and processing records."
};

export default function AdminGdprPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Shield className="size-6 text-accent" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Compliance</p>
            <h2 className="text-3xl font-black">GDPR Compliance</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage data protection requests, consent records, and processing activities to maintain GDPR compliance.
        </p>
      </div>

      <GdprDashboard />
    </div>
  );
}
