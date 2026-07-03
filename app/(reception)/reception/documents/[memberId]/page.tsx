import type { Metadata } from "next";
import { ArrowLeft, Download, FileText, Trash2, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getMemberDocuments, getDocumentUrl } from "@/features/documents/services/document-service";
import { deleteDocumentAction } from "@/features/documents/actions/document-actions";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Documents",
  description: "View and manage documents for a member.",
  path: "/reception/documents"
});

type MemberDocumentsPageProps = {
  params: Promise<{ memberId: string }>;
};

interface DocumentWithUrl {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  document_type: string;
  mime_type: string;
  created_at: string;
  url: string;
}

export default async function MemberDocumentsPage({ params }: MemberDocumentsPageProps) {
  const { memberId } = await params;
  const scope = await requireReceptionScope("/reception/documents");

  const [documents, membersResult] = await Promise.all([
    getMemberDocuments(memberId, scope.gymId, {
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    }),
    listMembers({
      gymId: scope.gymId,
      branchId: scope.branchId,
      organizationId: scope.scopedOrganizationId ?? scope.organizationId,
      query: memberId,
      pageSize: 1
    })
  ]);

  const member = membersResult.members[0] ?? null;

  const documentsWithUrls: DocumentWithUrl[] = await Promise.all(
    documents.map(async (doc) => {
      const url = await getDocumentUrl(doc.file_path);
      return {
        id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_size: doc.file_size,
        document_type: doc.document_type,
        mime_type: doc.mime_type,
        created_at: doc.created_at,
        url
      };
    })
  );

  if (!member) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <ButtonLink href="/reception/documents" size="icon" variant="ghost">
            <ArrowLeft className="size-5" />
          </ButtonLink>
          <h2 className="text-2xl font-black">Member not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-4">
        <ButtonLink href="/reception/documents" size="icon" variant="ghost">
          <ArrowLeft className="size-5" />
        </ButtonLink>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Documents</p>
          <h2 className="text-2xl font-black">{member.full_name}</h2>
          <p className="text-sm text-muted-foreground">
            {member.member_code} · {member.phone}{member.email ? ` · ${member.email}` : ""}
          </p>
        </div>
      </section>

      <section className="flex gap-3">
        <ButtonLink href={`/reception/documents/upload?memberId=${memberId}`} variant="secondary">
          <Upload className="size-4" />
          Upload Document
        </ButtonLink>
      </section>

      {documentsWithUrls.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {documentsWithUrls.map((doc) => (
            <div className="rounded-lg border border-border bg-surface p-4" key={doc.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="size-5 text-accent" />
                    <p className="font-black">{doc.file_name}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {doc.document_type.replaceAll("_", " ")} · {(doc.file_size / 1024).toFixed(1)} KB
                    {" · "}{new Date(doc.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-surface-muted"
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download"
                  >
                    <Download className="size-4" />
                  </a>
                  <form action={deleteDocumentAction}>
                    <input name="documentId" type="hidden" value={doc.id} />
                    <input name="filePath" type="hidden" value={doc.file_path} />
                    <button
                      className="inline-flex size-8 items-center justify-center rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
                      title="Delete"
                      type="submit"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center text-sm font-semibold text-muted-foreground">
          No documents uploaded for this member. Click Upload Document to add one.
        </div>
      )}
    </div>
  );
}
