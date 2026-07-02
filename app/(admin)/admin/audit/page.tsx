import type { Metadata } from "next";
import { FileText, Shield } from "lucide-react";
import { AuditTrailViewer } from "@/features/audit/components/audit-trail-viewer";

export const metadata: Metadata = {
  title: "Audit Trail",
  description: "View and search all audit logs for security and compliance."
};

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Shield className="size-6 text-accent" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Security</p>
            <h2 className="text-3xl font-black">Audit Trail</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Comprehensive view of all system activities. Track user actions, security events, and data changes for compliance and troubleshooting.
        </p>
      </div>

      <AuditTrailViewer />
    </div>
  );
}
