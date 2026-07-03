import type { Metadata } from "next";
import { FileText, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Documents",
  description: "Upload and manage member documents, IDs, medical forms, and agreements.",
  path: "/reception/documents"
});

export default async function ReceptionDocumentsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const scope = await requireReceptionScope("/reception/documents");
  const params = await searchParams;
  const result = await listMembers({
    gymId: scope.gymId,
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    query: params.q || undefined,
    page: Number(params.page ?? "1"),
    pageSize: 25
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Documents</p>
        <h2 className="mt-2 text-3xl font-black">Document management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Upload and manage member identity documents, medical declarations, agreements, and supporting files.
        </p>
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_auto]" method="get">
            <Input
              name="q"
              placeholder="Search member by name, phone, or email..."
              defaultValue={params.q ?? ""}
            />
            <button
              className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground"
              type="submit"
            >
              Search Members
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {result.members.map((member) => (
          <div className="rounded-md border border-border bg-surface p-4" key={member.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{member.full_name}</p>
                  <Badge variant="neutral">{member.member_code}</Badge>
                </div>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {member.phone}{member.email ? ` · ${member.email}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <ButtonLink
                  className="text-xs"
                  href={`/reception/documents/upload?memberId=${member.id}`}
                  size="sm"
                  variant="secondary"
                >
                  <Upload className="size-3.5" />
                  Upload
                </ButtonLink>
                <ButtonLink
                  className="text-xs"
                  href={`/reception/documents/${member.id}`}
                  size="sm"
                  variant="outline"
                >
                  <FileText className="size-3.5" />
                  View Docs
                </ButtonLink>
              </div>
            </div>
          </div>
        ))}
        {result.members.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
            No members found. Search for a member to manage their documents.
          </div>
        ) : null}
      </div>
    </div>
  );
}
