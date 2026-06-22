"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Phone,
  Mail,
  UserRoundPlus,
  UserRoundCheck,
  ArrowRightLeft,
  TrendingUp,
  SearchX,
  Inbox,
  Trash2,
} from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { LeadRow } from "@/features/organization-owner/services/lead-service";
import type { ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import {
  getOrgLeads,
  updateLeadStatus,
  convertLeadToMember,
  deleteLead,
} from "@/features/organization-owner/actions/lead-actions";

type LeadsModuleProps = {
  dashboard: OrganizationOwnerDashboard;
  moduleData?: { items: LeadRow[] } | undefined;
  moduleFilters?: ModuleSearchParams | undefined;
};

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "trial_scheduled", label: "Trial Scheduled" },
  { value: "trial_attended", label: "Trial Attended" },
  { value: "negotiation", label: "Negotiation" },
  { value: "converted", label: "Won" },
  { value: "lost", label: "Lost" },
];

const SOURCE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "other", label: "Other" },
  { value: "free_trial", label: "Free Trial" },
  { value: "membership_inquiry", label: "Membership Inquiry" },
  { value: "contact", label: "Contact" },
];

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-amber-100 text-amber-800 border-amber-200",
  trial_scheduled: "bg-purple-100 text-purple-800 border-purple-200",
  trial_attended: "bg-indigo-100 text-indigo-800 border-indigo-200",
  negotiation: "bg-orange-100 text-orange-800 border-orange-200",
  won: "bg-green-100 text-green-800 border-green-200",
  lost: "bg-red-100 text-red-800 border-red-200",
  converted: "bg-green-100 text-green-800 border-green-200",
  trial_completed: "bg-teal-100 text-teal-800 border-teal-200",
  spam: "bg-gray-100 text-gray-600 border-gray-200",
};

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status.replace(/_/g, " ");
}

function sourceLabel(source: string) {
  return SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? source.replace(/_/g, " ");
}

export function LeadsModule({ dashboard, moduleData, moduleFilters }: LeadsModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [leads, setLeads] = useState<LeadRow[]>(moduleData?.items ?? []);
  const [total, setTotal] = useState(moduleData?.items?.length ?? 0);
  const [loading, setLoading] = useState(false);
  const [detailLead, setDetailLead] = useState<LeadRow | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertGymId, setConvertGymId] = useState("");
  const [detailNotes, setDetailNotes] = useState("");

  const orgId = dashboard.organization.id;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getOrgLeads(orgId, {
        q: filters.q || undefined,
        status: filters.status || undefined,
        source: filters.source || undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      });
      setLeads(result.leads);
      setTotal(result.total);
    } catch {
      showToast("Failed to load leads", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, filters.q, filters.status, filters.source, filters.page, filters.pageSize]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const openDetail = useCallback((lead: LeadRow) => {
    setDetailLead(lead);
    setDetailNotes(lead.notes ?? "");
    setConvertGymId(lead.gym_id ?? dashboard.gyms[0]?.id ?? "");
  }, [dashboard.gyms]);

  const closeDetail = useCallback(() => {
    setDetailLead(null);
    setConvertingId(null);
  }, []);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!detailLead) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateLeadStatus(orgId, detailLead.id, newStatus, detailNotes);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setDetailLead(updated);
      showToast(`Status updated to ${statusLabel(newStatus)}`, "success");
    } catch {
      showToast("Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  }, [orgId, detailLead, detailNotes]);

  const handleNotesSave = useCallback(async () => {
    if (!detailLead) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateLeadStatus(orgId, detailLead.id, detailLead.status, detailNotes);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setDetailLead(updated);
      showToast("Notes saved", "success");
    } catch {
      showToast("Failed to save notes", "error");
    } finally {
      setUpdatingStatus(false);
    }
  }, [orgId, detailLead, detailNotes]);

  const handleConvert = useCallback(async () => {
    if (!detailLead || !convertGymId) return;
    setConvertingId(detailLead.id);
    try {
      const result = await convertLeadToMember(orgId, detailLead.id, convertGymId);
      setLeads((prev) => prev.map((l) => (l.id === result.lead.id ? result.lead : l)));
      setDetailLead(result.lead);
      showToast("Lead converted to member", "success");
    } catch {
      showToast("Failed to convert lead", "error");
    } finally {
      setConvertingId(null);
    }
  }, [orgId, detailLead, convertGymId]);

  const handleDelete = useCallback(async () => {
    if (!detailLead) return;
    try {
      await deleteLead(orgId, detailLead.id);
      setLeads((prev) => prev.filter((l) => l.id !== detailLead.id));
      setTotal((prev) => prev - 1);
      showToast("Lead deleted", "success");
      closeDetail();
    } catch {
      showToast("Failed to delete lead", "error");
    }
  }, [orgId, detailLead, closeDetail]);

  const handleApplyFilters = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, status: f.status, source: f.source });
  }, [navigate]);

  const newCount = leads.filter((l) => l.status === "new").length;
  const contactedCount = leads.filter((l) => l.status === "contacted").length;
  const wonCount = leads.filter((l) => l.status === "converted").length;
  const lostCount = leads.filter((l) => l.status === "lost").length;

  const items = leads.map((lead) => ({
    id: lead.id,
    title: lead.name,
    subtitle: `${lead.phone} · ${lead.email || "No email"}`,
    meta: `Source: ${sourceLabel(lead.source)} · ${new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    badge: statusLabel(lead.status),
    badgeVariant: (lead.status === "converted" ? "success" : lead.status === "lost" ? "error" : lead.status === "new" ? "info" : "warning") as "success" | "warning" | "error" | "neutral" | "info" | "premium",
    status: lead.status,
    avatar: (
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${lead.status === "converted" ? "bg-green-500" : lead.status === "lost" ? "bg-red-500" : lead.status === "new" ? "bg-blue-500" : "bg-amber-500"}`}>
        {lead.name.charAt(0).toUpperCase()}
      </div>
    ),
    sections: [
      { label: "Phone", value: lead.phone, icon: <Phone className="size-3.5" /> },
      { label: "Email", value: lead.email ?? "—", icon: <Mail className="size-3.5" /> },
      { label: "Source", value: sourceLabel(lead.source) },
      { label: "Created", value: new Date(lead.created_at).toLocaleDateString("en-IN") },
      { label: "Interest", value: lead.interest ?? "—" },
    ],
    actions: [
      { label: "Details", onClick: () => openDetail(lead), variant: "secondary" as const },
    ],
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total leads captured" icon={<UserRoundPlus className="size-5" />} label="Total Leads" value={formatCompactNumber(total)} />
        <StatCard detail="New leads awaiting contact" icon={<Inbox className="size-5" />} label="New" value={formatCompactNumber(newCount)} />
        <StatCard detail="Leads marked as won or converted" icon={<UserRoundCheck className="size-5" />} label="Won" value={formatCompactNumber(wonCount)} />
        <StatCard detail="Leads marked as lost" icon={<SearchX className="size-5" />} label="Lost" value={formatCompactNumber(lostCount)} />
        <StatCard detail="Leads in contacted status" icon={<Phone className="size-5" />} label="Contacted" value={formatCompactNumber(contactedCount)} />
        <StatCard detail="Lead conversion rate" icon={<TrendingUp className="size-5" />} label="Conversion" value={`${total > 0 ? Math.round((wonCount / total) * 100) : 0}%`} />
      </section>

      {/* Filters */}
      <FilterBar
        filterGroups={[
          {
            key: "status",
            label: "Status",
            options: [{ value: "all", label: "All" }, ...STATUS_OPTIONS],
            defaultValue: "all",
          },
          {
            key: "source",
            label: "Source",
            options: [{ value: "all", label: "All" }, ...SOURCE_OPTIONS],
            defaultValue: "all",
          },
        ]}
        searchPlaceholder="Search by name, phone, or email..."
        onApply={handleApplyFilters}
        activeFilters={filters as unknown as Record<string, string>}
      />

      {/* Data List */}
      {!loading && leads.length === 0 ? (
        <EmptyState
          type="no_data"
          title="No leads yet"
          description="Leads will appear here when they are submitted through your website forms, walk-ins, or other channels."
        />
      ) : (
        <DataList
          loading={loading}
          headerTitle="Leads"
          items={items}
          totalItems={total}
          totalPages={Math.ceil(total / (filters.pageSize ?? 12))}
          currentPage={currentPage}
          onPageChange={(p) => navigate({ page: p })}
          pageSize={filters.pageSize ?? 12}
        />
      )}

      {/* Detail Drawer */}
      {detailLead ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={closeDetail}>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${detailLead.name} details`}>
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${detailLead.status === "converted" ? "bg-green-500" : detailLead.status === "lost" ? "bg-red-500" : detailLead.status === "new" ? "bg-blue-500" : "bg-amber-500"}`}>
                  {detailLead.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black truncate">{detailLead.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[detailLead.status] ?? "border-border bg-surface-muted text-muted-foreground"}`}>
                      {statusLabel(detailLead.status)}
                    </span>
                  </p>
                </div>
              </div>
              <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={closeDetail} type="button" aria-label="Close">
                <ArrowRightLeft className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Contact */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Contact Information</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-bold">{detailLead.phone}</p></div>
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-bold">{detailLead.email ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm font-bold">{sourceLabel(detailLead.source)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm font-bold">{new Date(detailLead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Interest</p><p className="text-sm font-bold">{detailLead.interest ?? "—"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Message</p><p className="text-sm font-bold">{detailLead.message || "—"}</p></div>
                </CardContent>
              </Card>

              {/* Status */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Status Management</h3></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Current Status</p>
                    <select
                      className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={detailLead.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Notes</h3></CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    className="h-32 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    placeholder="Add notes about this lead..."
                  />
                  <Button onClick={handleNotesSave} disabled={updatingStatus} size="sm" variant="secondary">
                    {updatingStatus ? "Saving..." : "Save Notes"}
                  </Button>
                </CardContent>
              </Card>

              {/* Convert to Member */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Convert to Member</h3></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Select gym for membership</p>
                    <select
                      className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={convertGymId}
                      onChange={(e) => setConvertGymId(e.target.value)}
                    >
                      <option value="">Select gym</option>
                      {dashboard.gyms.map((gym) => (
                        <option key={gym.id} value={gym.id}>{gym.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleConvert}
                    disabled={convertingId === detailLead.id || !convertGymId || detailLead.status === "converted"}
                    size="sm"
                    variant="primary"
                  >
                    {convertingId === detailLead.id ? "Converting..." : detailLead.status === "converted" ? "Already Converted" : "Convert to Member"}
                  </Button>
                </CardContent>
              </Card>

              {/* Delete */}
              <Card className="border-red-200">
                <CardHeader><h3 className="text-lg font-black text-red-600">Danger Zone</h3></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">Permanently remove this lead and all associated data.</p>
                  <Button onClick={handleDelete} size="sm" variant="destructive">
                    <Trash2 className="size-4 mr-1.5" />
                    Delete Lead
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
