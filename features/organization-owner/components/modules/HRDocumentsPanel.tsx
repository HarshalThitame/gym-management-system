"use client";

import { useCallback, useEffect, useState, useActionState, useRef } from "react";
import { Upload, Trash2, Download, FileText, Shield, FileCheck, Briefcase, MoreHorizontal, AlertCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { OrgOwnerDrawer, DrawerField, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import {
  getHRDocuments,
  getExpiringDocuments,
  uploadHRDocument,
  deleteHRDocument,
  type HRDocument,
} from "@/features/organization-owner/actions/hr-actions";
import { cn } from "@/lib/utils";

type HRDocumentsPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const docTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  contract: FileText,
  certificate: FileCheck,
  id_proof: Shield,
  joining_letter: Briefcase,
  other: MoreHorizontal,
};

const docTypeLabels: Record<string, string> = {
  contract: "Contract",
  certificate: "Certificate",
  id_proof: "ID Proof",
  joining_letter: "Joining Letter",
  other: "Other",
};

function isExpired(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false;
  const d: string = expiryDate;
  return new Date(d) < new Date();
}

function isExpiringSoon(expiryDate: string | null | undefined, daysThreshold: number = 30): boolean {
  if (!expiryDate) return false;
  if (isExpired(expiryDate)) return false;
  const d: string = expiryDate;
  const exp = new Date(d);
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= daysThreshold;
}

export function HRDocumentsPanel({ dashboard, hasFeature }: HRDocumentsPanelProps) {
  const orgId = dashboard.organization.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const staffList = (dashboard.branchUsers as Record<string, unknown>[])
    .filter((bu) => bu.status !== "revoked")
    .map((bu) => {
      const profile = bu.profiles as { full_name?: string; email?: string } | null;
      return { id: bu.user_id as string, name: profile?.full_name ?? profile?.email ?? "Unknown" };
    })
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);

  const [documents, setDocuments] = useState<HRDocument[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<HRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadState, uploadFormAction] = useActionState(uploadHRDocument, initialAuthActionState);
  const [filterStaffId, setFilterStaffId] = useState("");
  const [filterDocType, setFilterDocType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const filterArgs: { staffId?: string; docType?: string } = {};
      if (filterStaffId) filterArgs.staffId = filterStaffId;
      if (filterDocType) filterArgs.docType = filterDocType;
      const [docs, expiring] = await Promise.all([
        getHRDocuments(orgId, Object.keys(filterArgs).length > 0 ? filterArgs : undefined),
        getExpiringDocuments(orgId, 30),
      ]);
      setDocuments(docs);
      setExpiringDocs(expiring.filter((d) => !isExpired(d.expiry_date)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load documents.", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, filterStaffId, filterDocType]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (uploadState.status === "success") {
      setDrawerOpen(false);
      setSelectedFile(null);
      loadDocuments();
      showToast("Document uploaded.", "success");
    } else if (uploadState.status === "error" && uploadState.message) {
      showToast(uploadState.message, "error");
    }
  }, [uploadState, loadDocuments]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) setSelectedFile(file);
  }, []);

  const handleDelete = useCallback(async (documentId: string) => {
    setDeleteConfirmId(null);
    const fd = new FormData();
    fd.set("documentId", documentId);
    const r = await deleteHRDocument(initialAuthActionState, fd);
    if (r.status !== "success") showToast(r.message || "Failed to delete.", "error");
    else {
      showToast("Document deleted.", "success");
      loadDocuments();
    }
  }, [loadDocuments]);

  const handleDeleteConfirm = useCallback((documentId: string) => {
    setDeleteConfirmId(documentId);
  }, []);

  const handleCustomUpload = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("organizationId", orgId);

      const res = await fetch("/api/hr/documents", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Upload failed");

      const actionFd = new FormData();
      const selectedStaffId = (e.currentTarget.querySelector("[name='staffId']") as HTMLSelectElement)?.value;
      const docType = (e.currentTarget.querySelector("[name='docType']") as HTMLSelectElement)?.value;
      const expiryDate = (e.currentTarget.querySelector("[name='expiryDate']") as HTMLInputElement)?.value;
      const notes = (e.currentTarget.querySelector("[name='notes']") as HTMLTextAreaElement)?.value;

      actionFd.set("staffId", selectedStaffId);
      actionFd.set("docType", docType);
      actionFd.set("fileName", json.fileName || selectedFile.name);
      actionFd.set("fileUrl", json.fileUrl);
      actionFd.set("fileSize", String(json.fileSize ?? selectedFile.size));
      actionFd.set("contentType", json.contentType ?? selectedFile.type);
      if (expiryDate) actionFd.set("expiryDate", expiryDate);
      if (notes) actionFd.set("notes", notes);

      await uploadFormAction(actionFd);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }, [selectedFile, orgId, uploadFormAction]);

  if (!hasFeature) {
    return (
      <div className="rounded-md border border-border bg-surface p-8 text-center">
        <FileText className="mx-auto size-10 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">HR document storage requires a Growth or Enterprise plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {expiringDocs.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">{expiringDocs.length} document{expiringDocs.length > 1 ? "s" : ""} expiring within 30 days</p>
            <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
              {expiringDocs.slice(0, 5).map((d) => (
                <li key={d.id}>{d.staff_name ?? "Unknown"} — {docTypeLabels[d.doc_type] ?? d.doc_type}: {d.file_name} (expires {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString("en-IN") : "N/A"})</li>
              ))}
              {expiringDocs.length > 5 ? <li>...and {expiringDocs.length - 5} more</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3 flex-1 flex-wrap">
          <select className={cn(selectClass, "max-w-[200px]")} value={filterStaffId} onChange={(e) => setFilterStaffId(e.target.value)}>
            <option value="">All Staff</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={cn(selectClass, "max-w-[180px]")} value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(docTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Button onClick={() => setDrawerOpen(true)} variant="primary" size="sm">
          <Upload className="size-4" /> Upload Document
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading documents...</p>
      ) : documents.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No HR documents uploaded yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Upload contracts, certificates, ID proofs, and other staff documents.</p>
        </div>
      ) : (
        <DataList
          items={documents.map((doc) => {
            const Icon = docTypeIcons[doc.doc_type] ?? FileText;
            const expired = isExpired(doc.expiry_date);
            const expiringSoon = isExpiringSoon(doc.expiry_date);
            return {
              id: doc.id,
              title: doc.file_name,
              subtitle: doc.staff_name ?? "Unknown Staff",
              meta: `${docTypeLabels[doc.doc_type] ?? doc.doc_type} · Uploaded ${new Date(doc.created_at).toLocaleDateString("en-IN")}${doc.expiry_date ? ` · Expires ${new Date(doc.expiry_date).toLocaleDateString("en-IN")}` : ""}${doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(1)} KB` : ""}`,
              badge: expired ? "Expired" : expiringSoon ? "Expiring" : "Valid",
              badgeVariant: expired ? "neutral" : expiringSoon ? "warning" : "success" as "success" | "warning" | "neutral",
              avatar: <Icon className={cn("size-9 shrink-0 rounded-full p-1.5", expired ? "bg-red-100 text-red-600" : expiringSoon ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600")} />,
              sections: [
                { label: "Type", value: docTypeLabels[doc.doc_type] ?? doc.doc_type },
                { label: "Staff", value: doc.staff_name ?? "Unknown" },
                { label: "Size", value: doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "—" },
                { label: "Uploaded", value: new Date(doc.created_at).toLocaleDateString("en-IN") },
                { label: "Expiry", value: doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString("en-IN") : "No expiry" },
              ],
              actions: (() => {
                const acts: Array<{ label: string; onClick: () => void; variant: "secondary" | "destructive"; icon: React.ReactNode }> = [
                  { label: "View", onClick: () => window.open(doc.file_url, "_blank"), variant: "secondary" as const, icon: <Download className="size-3.5" /> },
                ];
                if (deleteConfirmId === doc.id) {
                  acts.push({ label: "Confirm delete?", onClick: () => handleDelete(doc.id), variant: "destructive", icon: <Trash2 className="size-3.5" /> });
                  acts.push({ label: "Cancel", onClick: () => setDeleteConfirmId(null), variant: "secondary", icon: <Trash2 className="size-3.5" /> });
                } else {
                  acts.push({ label: "Delete", onClick: () => handleDeleteConfirm(doc.id), variant: "destructive", icon: <Trash2 className="size-3.5" /> });
                }
                return acts;
              })(),
            };
          })}
          totalItems={documents.length}
          headerTitle="HR Documents"
        />
      )}

      <OrgOwnerDrawer
        description="Upload a contract, certificate, ID proof, or other document"
        onClose={() => { setDrawerOpen(false); setSelectedFile(null); }}
        open={drawerOpen}
        title="Upload Document"
        size="md"
      >
        <form onSubmit={handleCustomUpload} className="space-y-5">
          <DrawerFormMessage status={uploadState.status} message={uploadState.message} />

          <DrawerField label="Staff Member" required>
            <select className={selectClass} name="staffId" required>
              <option value="">Select staff</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </DrawerField>

          <DrawerField label="Document Type" required>
            <select className={selectClass} name="docType" required>
              <option value="">Select type</option>
              {Object.entries(docTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </DrawerField>

          <DrawerField label="File" required>
            {selectedFile ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="size-8 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button className="text-xs text-red-500 hover:text-red-700 shrink-0" onClick={() => setSelectedFile(null)} type="button">Remove</button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-muted-foreground">Drag & drop a file or click to browse</p>
                <p className="text-xs text-muted-foreground">PDF, images, DOC/DOCX, TXT (max 10MB)</p>
              </div>
            )}
            <input ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt" onChange={handleFileChange} type="file" />
          </DrawerField>

          <DrawerField label="Expiry Date">
            <input className={selectClass} name="expiryDate" type="date" />
          </DrawerField>

          <DrawerField label="Notes">
            <textarea className={cn(selectClass, "min-h-[80px] resize-y")} name="notes" placeholder="Optional notes..." />
          </DrawerField>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={() => { setDrawerOpen(false); setSelectedFile(null); }} type="button">Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50" disabled={!selectedFile || uploading} type="submit">
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
