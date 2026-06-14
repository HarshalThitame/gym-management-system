"use client";

import { useCallback, useMemo, useState, useActionState } from "react";
import { BookOpen, CheckCircle2, Clock, Eye, LifeBuoy, MessageSquare, Plus, Search, XCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { createTicketAction, updateTicketStatusAction, closeTicketAction } from "@/features/organization-owner/actions/support-actions";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";

type SupportEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: unknown; moduleFilters?: Record<string, unknown>; };

type Ticket = {
  id: string;
  subject: string;
  description: string;
  priority: string;
  category: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  lastNote: string | null;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const KNOWLEDGE_BASE = [
  { title: "How to add a new member", category: "Members", readTime: "2 min", icon: "👤" },
  { title: "Setting up membership plans", category: "Plans", readTime: "3 min", icon: "📋" },
  { title: "Managing staff roles & permissions", category: "Staff", readTime: "4 min", icon: "🔐" },
  { title: "Understanding billing & invoices", category: "Billing", readTime: "3 min", icon: "💰" },
  { title: "How to transfer members between gyms", category: "Members", readTime: "2 min", icon: "🔄" },
  { title: "Troubleshooting attendance issues", category: "Attendance", readTime: "3 min", icon: "📊" },
  { title: "Setting up custom domains", category: "Domains", readTime: "5 min", icon: "🌐" },
  { title: "White label branding guide", category: "Branding", readTime: "4 min", icon: "🎨" },
  { title: "Managing membership plan pricing", category: "Plans", readTime: "3 min", icon: "💵" },
  { title: "How to run member campaigns", category: "Communications", readTime: "4 min", icon: "📧" },
];

export function SupportEnterpriseModule({ dashboard }: SupportEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [searchKnowledge, setSearchKnowledge] = useState("");
  const [state, formAction] = useActionState(createTicketAction, initialAuthActionState);

  // Parse tickets from activity_events
  const tickets: Ticket[] = useMemo(() => {
    return dashboard.activityEvents
      .filter((e) => e.entity_type === "support_ticket" || e.event_type.startsWith("support_ticket:"))
      .map((e) => {
        const meta = (e.metadata ?? {}) as Record<string, string>;
        return {
          id: e.id,
          subject: meta.subject ?? e.event_type.replace("support_ticket:", "").slice(0, 100),
          description: meta.description ?? "",
          priority: meta.priority ?? "normal",
          category: meta.category ?? null,
          status: meta.ticket_status ?? "open",
          createdAt: e.created_at,
          updatedAt: meta.updated_at ?? null,
          lastNote: meta.last_note ?? null,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [dashboard.activityEvents]);

  // ── KPIs ──
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "open" || t.status === "in_progress").length;
  const closedCount = tickets.filter((t) => t.status === "closed" || t.status === "resolved").length;
  const highPriorityCount = tickets.filter((t) => t.priority === "high" || t.priority === "critical").length;
  const avgResolutionTime = useMemo(() => {
    const closedTickets = tickets.filter((t) => t.status === "closed" || t.status === "resolved");
    if (closedTickets.length === 0) return null;
    const totalHours = closedTickets.reduce((sum, t) => {
      const created = new Date(t.createdAt).getTime();
      const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : Date.now();
      return sum + (updated - created) / 3600000;
    }, 0);
    return Math.round(totalHours / closedTickets.length);
  }, [tickets]);

  const openCreate = useCallback(() => setCreateDrawerOpen(true), []);
  const closeCreate = useCallback(() => setCreateDrawerOpen(false), []);

  const handleUpdateStatus = useCallback(async (ticketId: string, status: string) => {
    const fd = new FormData(); fd.set("ticketId", ticketId); fd.set("status", status);
    const r = await updateTicketStatusAction({ status: "idle" }, fd);
    showToast(r.message || `Ticket ${status}`, r.status === "success" ? "success" : "error");
  }, []);

  const handleClose = useCallback(async (ticketId: string) => {
    const resolution = prompt("Resolution summary:");
    if (!resolution) return;
    const fd = new FormData(); fd.set("ticketId", ticketId); fd.set("resolution", resolution);
    const r = await closeTicketAction({ status: "idle" }, fd);
    showToast(r.message || "Ticket closed", r.status === "success" ? "success" : "error");
  }, []);

  const kbFiltered = KNOWLEDGE_BASE.filter((a) =>
    a.title.toLowerCase().includes(searchKnowledge.toLowerCase()) ||
    a.category.toLowerCase().includes(searchKnowledge.toLowerCase())
  );

  const items = tickets.map((t) => ({
    id: t.id,
    title: t.subject,
    subtitle: t.description.slice(0, 100) + (t.description.length > 100 ? "..." : ""),
    meta: `${t.category ?? "General"} · Priority: ${t.priority} · ${new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    badge: t.status,
    badgeVariant: (t.status === "open" || t.status === "in_progress" ? "warning" : t.status === "closed" ? "neutral" : "success") as "warning" | "neutral" | "success",
    status: t.status,
    sections: [
      { label: "Status", value: t.status },
      { label: "Priority", value: t.priority },
      { label: "Category", value: t.category ?? "General" },
      { label: "Created", value: new Date(t.createdAt).toLocaleDateString("en-IN") },
    ],
    actions: [
      { label: "View", onClick: () => setDetailTicket(t), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
      ...(t.status === "open" || t.status === "in_progress"
        ? [{ label: "Close", onClick: () => handleClose(t.id), variant: "destructive" as const, icon: <CheckCircle2 className="size-3.5" /> }]
        : t.status === "closed"
        ? [{ label: "Reopen", onClick: () => handleUpdateStatus(t.id, "open"), variant: "primary" as const, icon: <LifeBuoy className="size-3.5" /> }]
        : [])
    ]
  }));

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total support tickets" icon={<LifeBuoy className="size-5" />} label="Total Tickets" value={String(tickets.length)} />
        <StatCard detail="Open or in-progress tickets" icon={<MessageSquare className="size-5" />} label="Open" status={openCount > 0 ? "watch" : "good"} value={String(openCount)} />
        <StatCard detail="High or critical priority tickets" icon={<XCircle className="size-5" />} label="High Priority" status={highPriorityCount > 0 ? "risk" : "good"} value={String(highPriorityCount)} />
        <StatCard detail="Resolved or closed tickets" icon={<CheckCircle2 className="size-5" />} label="Resolved" value={String(closedCount)} />
        <StatCard detail="Average resolution time for closed tickets" icon={<Clock className="size-5" />} label="Avg Resolution" value={avgResolutionTime ? `${avgResolutionTime} hours` : "—"} />
        <StatCard detail="Knowledge base articles" icon={<BookOpen className="size-5" />} label="Articles" value={String(KNOWLEDGE_BASE.length)} />
      </section>

      {/* ═══ TICKET LIST ═══ */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground">Tickets ({tickets.length})</p>
        <div className="flex gap-2">
          <Button onClick={() => setKnowledgeOpen(!knowledgeOpen)} size="sm" variant="secondary"><BookOpen className="size-3.5" /> {knowledgeOpen ? "Hide KB" : "Knowledge Base"}</Button>
          <Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create Ticket</Button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
          <LifeBuoy className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-muted-foreground">No support tickets yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a ticket to get help from the platform team.</p>
          <Button onClick={openCreate} size="sm" variant="primary" className="mt-4"><Plus className="size-3.5" /> Create Ticket</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice((currentPage - 1) * 10, currentPage * 10).map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface p-4 transition-all hover:border-border-strong">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold">{item.title}</h4>
                    <EnterpriseStatusBadge status={item.status} />
                    {item.sections?.map((s) => s.label === "Priority" ? (
                      <span key={s.value} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.value === "critical" ? "bg-red-100 text-red-700" :
                        s.value === "high" ? "bg-amber-100 text-amber-700" :
                        s.value === "normal" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>{s.value}</span>
                    ) : null)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {item.actions.map((a) => (
                    <button key={a.label}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                        a.variant === "destructive" ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100" :
                        a.variant === "primary" ? "bg-primary text-primary-foreground shadow-sm" :
                        "border border-border bg-surface text-foreground hover:border-border-strong"
                      }`}
                      onClick={a.onClick} type="button"
                    >
                      {a.icon} {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {tickets.length > 10 ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-muted-foreground">Page {currentPage} of {Math.ceil(tickets.length / 10)}</p>
          <div className="flex gap-2">
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold disabled:opacity-30" disabled={currentPage <= 1} onClick={() => navigate({ page: currentPage - 1 })} type="button">Previous</button>
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold disabled:opacity-30" disabled={currentPage >= Math.ceil(tickets.length / 10)} onClick={() => navigate({ page: currentPage + 1 })} type="button">Next</button>
          </div>
        </div>
      ) : null}

      {/* ═══ CREATE TICKET DRAWER ═══ */}
      <OrgOwnerDrawer description="Submit a support request" onClose={closeCreate} open={createDrawerOpen} title="Create Ticket" size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <DrawerField label="Subject" required>
            <input className={selectClass} name="subject" required type="text" placeholder="Brief description of the issue" />
          </DrawerField>
          <DrawerField label="Description" required>
            <textarea className={`${selectClass} min-h-[120px]`} name="description" required placeholder="Detailed explanation..." rows={5} />
          </DrawerField>
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Priority">
              <select className={selectClass} defaultValue="normal" name="priority">
                <option value="low">Low</option><option value="normal">Normal</option>
                <option value="high">High</option><option value="critical">Critical</option>
              </select>
            </DrawerField>
            <DrawerField label="Category">
              <select className={selectClass} defaultValue="" name="category">
                <option value="">General</option><option value="billing">Billing</option>
                <option value="technical">Technical</option><option value="account">Account</option>
                <option value="feature">Feature Request</option>
              </select>
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeCreate} type="button">Cancel</button>
            <DrawerSubmitButton>Submit Ticket</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ KNOWLEDGE BASE PANEL ═══ */}
      {knowledgeOpen ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><h3 className="text-2xl font-black">Knowledge Base</h3><p className="text-sm text-muted-foreground">Help articles and guides for common tasks</p></div>
              <Button onClick={() => setKnowledgeOpen(false)} size="sm" variant="ghost">Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" placeholder="Search knowledge base..." value={searchKnowledge} onChange={(e) => setSearchKnowledge(e.target.value)} type="text" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {kbFiltered.map((article) => (
                <div key={article.title} className="flex items-start gap-3 rounded-md border border-border bg-background p-4 transition-all hover:border-border-strong">
                  <span className="text-lg">{article.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{article.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-surface-muted px-2 py-0.5">{article.category}</span>
                      <span>{article.readTime} read</span>
                    </div>
                  </div>
                  <button className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold hover:border-border-strong" type="button">View</button>
                </div>
              ))}
              {kbFiltered.length === 0 ? <p className="col-span-2 text-center text-sm text-muted-foreground">No articles match your search.</p> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ═══ DETAIL PANEL ═══ */}
      {detailTicket ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={() => setDetailTicket(null)}>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ticket details">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black truncate">{detailTicket.subject}</h2>
                  <EnterpriseStatusBadge status={detailTicket.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{detailTicket.category ?? "General"} · {detailTicket.priority} priority</p>
              </div>
              <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => setDetailTicket(null)} type="button" aria-label="Close"><LifeBuoy className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <Card>
                <CardHeader><h3 className="text-lg font-black">Description</h3></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap">{detailTicket.description}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><h3 className="text-lg font-black">Details</h3></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={detailTicket.status} /></div>
                  <div><p className="text-xs text-muted-foreground">Priority</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      detailTicket.priority === "critical" ? "bg-red-100 text-red-700" :
                      detailTicket.priority === "high" ? "bg-amber-100 text-amber-700" :
                      detailTicket.priority === "normal" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{detailTicket.priority}</span>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm font-bold">{detailTicket.category ?? "General"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm font-bold">{new Date(detailTicket.createdAt).toLocaleString("en-IN")}</p></div>
                  {detailTicket.updatedAt ? <div><p className="text-xs text-muted-foreground">Last Updated</p><p className="text-sm font-bold">{new Date(detailTicket.updatedAt).toLocaleString("en-IN")}</p></div> : null}
                </CardContent>
              </Card>
              {detailTicket.lastNote ? (
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Latest Note</h3></CardHeader>
                  <CardContent><p className="text-sm">{detailTicket.lastNote}</p></CardContent>
                </Card>
              ) : null}
              <div className="flex gap-2">
                {detailTicket.status === "open" || detailTicket.status === "in_progress" ? (
                  <button className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm" onClick={() => { handleClose(detailTicket.id); setDetailTicket(null); }} type="button">
                    <CheckCircle2 className="size-4" /> Close Ticket
                  </button>
                ) : null}
                <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground hover:border-border-strong" onClick={() => setDetailTicket(null)} type="button">Back</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
