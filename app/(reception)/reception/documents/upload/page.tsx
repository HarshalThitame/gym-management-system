import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { DocumentUploadForm } from "@/features/documents/components/document-upload-form";
import { createMetadata } from "@/lib/seo/metadata";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = createMetadata({
  title: "Upload Document",
  description: "Upload identity documents, medical forms, and agreements for members.",
  path: "/reception/documents/upload"
});

type DocumentUploadPageProps = {
  searchParams: Promise<{ memberId?: string }>;
};

export default async function DocumentUploadPage({ searchParams }: DocumentUploadPageProps) {
  const scope = await requireReceptionScope("/reception/documents/upload");
  const params = await searchParams;

  const memberId = params.memberId;
  let memberName = "";

  if (memberId) {
    const membersResult = await listMembers({
      gymId: scope.gymId,
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
      query: memberId,
      pageSize: 1
    });
    memberName = membersResult.members[0]?.full_name ?? "";
  }

  const membersResult = await listMembers({
    gymId: scope.gymId,
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    pageSize: 100
  });

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/documents" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Documents</p>
          <h2 className="text-2xl font-black">Upload document{memberName ? ` for ${memberName}` : ""}</h2>
        </div>
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Document Upload</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Supported formats: JPG, PNG, WebP, PDF. Maximum size: 10 MB.
          </p>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm
            defaultMemberId={memberId ?? ""}
            members={membersResult.members}
          />
        </CardContent>
      </Card>
    </div>
  );
}
