import type { Metadata } from "next";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Export Reports",
  description: "Export daily operational reports for shift handover.",
  path: "/reception/reports/export"
});

export default async function ExportReportsPage() {
  const scope = await requireReceptionScope("/reception/reports/export");

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/reports" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reports</p>
          <h2 className="text-2xl font-black">Export Reports</h2>
        </div>
      </section>

      <p className="text-sm leading-6 text-muted-foreground">
        Export reports are available for end-of-shift handover and daily record keeping. Select a report type to generate.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed border-border bg-surface-muted p-6">
          <FileSpreadsheet className="mb-3 size-8 text-accent" />
          <p className="text-lg font-black">Attendance Export</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Today's check-ins, check-outs, and occupancy report.
          </p>
          <ButtonLink className="mt-4 w-full" href="/reception/reports/attendance" variant="secondary" size="sm">
            <Download className="size-3.5" />
            Export
          </ButtonLink>
        </Card>

        <Card className="border-dashed border-border bg-surface-muted p-6">
          <FileText className="mb-3 size-8 text-green-400" />
          <p className="text-lg font-black">Payment Export</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily payment collection summary by method.
          </p>
          <ButtonLink className="mt-4 w-full" href="/reception/reports/payments" variant="secondary" size="sm">
            <Download className="size-3.5" />
            Export
          </ButtonLink>
        </Card>

        <Card className="border-dashed border-border bg-surface-muted p-6">
          <FileSpreadsheet className="mb-3 size-8 text-blue-400" />
          <p className="text-lg font-black">Registrations Export</p>
          <p className="mt-1 text-sm text-muted-foreground">
            New member registrations for the period.
          </p>
          <ButtonLink className="mt-4 w-full" href="/reception/reports/registrations" variant="secondary" size="sm">
            <Download className="size-3.5" />
            Export
          </ButtonLink>
        </Card>

        <Card className="border-dashed border-border bg-surface-muted p-6">
          <FileText className="mb-3 size-8 text-purple-400" />
          <p className="text-lg font-black">Leads Export</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lead pipeline and follow-up status report.
          </p>
          <ButtonLink className="mt-4 w-full" href="/reception/reports/leads" variant="secondary" size="sm">
            <Download className="size-3.5" />
            Export
          </ButtonLink>
        </Card>

        <Card className="border-dashed border-border bg-surface-muted p-6">
          <FileSpreadsheet className="mb-3 size-8 text-amber-400" />
          <p className="text-lg font-black">Renewals Export</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Expiring and due-for-renewal memberships.
          </p>
          <ButtonLink className="mt-4 w-full" href="/reception/reports/renewals" variant="secondary" size="sm">
            <Download className="size-3.5" />
            Export
          </ButtonLink>
        </Card>
      </div>
    </div>
  );
}
