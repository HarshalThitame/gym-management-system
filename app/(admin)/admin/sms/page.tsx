import type { Metadata } from "next";
import { CheckCircle2, Clock, MessageSquare, Search, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SmsComposeForm } from "@/features/billing/components/sms-compose-form";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "SMS Management",
  description: "Monitor SMS delivery, view logs, and manage SMS templates.",
  path: "/admin/sms",
});

type SearchParams = Promise<{ q?: string; page?: string }>;

const PAGE_SIZE = 30;

export default async function AdminSmsPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/sms");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "sms_integration",
    actionName: "admin.sms.read",
  });

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const searchQuery = params.q?.trim() || "";

  // Aggregate stats
  const { data: agg } = await supabase
    .from("sms_logs")
    .select("status, created_at")
    .eq("gym_id", scope.gymId) as never as {
    data: Array<{ status: string; created_at: string }> | null;
    error: unknown;
  };

  const totalSent = (agg ?? []).length;
  const totalDelivered = (agg ?? []).filter((l) => l.status === "delivered" || l.status === "sent").length;
  const totalFailed = (agg ?? []).filter((l) => l.status === "failed").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = (agg ?? []).filter((l) => l.created_at?.startsWith(todayStr)).length;

  // SMS logs list with pagination
  let logsQuery = supabase
    .from("sms_logs")
    .select("id, to_phone, message, status, provider, queued_at, sent_at, delivered_at, error_message, member_id, campaign_id", { count: "exact" })
    .eq("gym_id", scope.gymId);

  if (searchQuery) {
    logsQuery = logsQuery.or(`to_phone.ilike.%${searchQuery}%,message.ilike.%${searchQuery}%`);
  }

  const { data: logs, count } = await logsQuery
    .order("queued_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{
      id: string; to_phone: string; message: string; status: string;
      provider: string; queued_at: string; sent_at: string | null;
      delivered_at: string | null; error_message: string | null;
      member_id: string | null; campaign_id: string | null;
    }> | null;
    count: number | null;
    error: unknown;
  };

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Fetch member names for the logs
  const memberIds = [...new Set((logs ?? []).map((l) => l.member_id).filter(Boolean))] as string[];
  const { data: members } = memberIds.length > 0
    ? await supabase.from("members").select("id, full_name").in("id", memberIds) as never as {
        data: Array<{ id: string; full_name: string }> | null;
        error: unknown;
      }
    : { data: [] as Array<{ id: string; full_name: string }> };
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  // Integration status
  const { data: integration } = await supabase
    .from("integrations")
    .select("status, error_message, last_sync_at")
    .eq("organization_id", organizationId)
    .eq("provider", "msg91_sms")
    .maybeSingle() as never as {
    data: { status: string; error_message: string | null; last_sync_at: string | null } | null;
    error: unknown;
  };

  const hasActiveFilters = !!searchQuery;

  function maskPhone(phone: string) {
    if (phone.length >= 10) return `${phone.slice(0, 2)}****${phone.slice(-4)}`;
    return phone;
  }

  function statusBadge(status: string) {
    switch (status) {
      case "delivered": return <Badge variant="success">Delivered</Badge>;
      case "sent": return <Badge variant="info">Sent</Badge>;
      case "queued": return <Badge variant="warning">Queued</Badge>;
      case "failed": return <Badge variant="error">Failed</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  }

  function statusIcon(status: string) {
    switch (status) {
      case "delivered": return <CheckCircle2 className="size-4 text-emerald-500" />;
      case "sent": return <Clock className="size-4 text-blue-500" />;
      case "queued": return <Clock className="size-4 text-amber-500" />;
      case "failed": return <XCircle className="size-4 text-red-500" />;
      default: return null;
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Communication</p>
        <h2 className="mt-2 text-3xl font-black">SMS Management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Monitor SMS delivery, view message logs, and track provider status. SMS is sent via MSG91.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total SMS messages sent" icon={<MessageSquare className="size-5" />} label="Total Sent" value={String(totalSent)} />
        <StatCard detail="Successfully delivered" icon={<CheckCircle2 className="size-5" />} label="Delivered" value={String(totalDelivered)} />
        <StatCard detail="Failed to deliver" icon={<XCircle className="size-5" />} label="Failed" value={String(totalFailed)} />
        <StatCard detail="Sent today" icon={<Clock className="size-5" />} label="Today" value={String(todayCount)} />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_auto]" method="get">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm" name="q" placeholder="Search by phone or message..." defaultValue={searchQuery} />
            </div>
            <button className="flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground" type="submit">Search</button>
            {hasActiveFilters ? <a href="/admin/sms" className="flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted">Clear</a> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">SMS Logs</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {hasActiveFilters ? `${count ?? 0} result${(count ?? 0) === 1 ? "" : "s"}` : "Recent SMS messages with delivery status."}
          </p>
        </CardHeader>
        <CardContent>
          {(!logs || logs.length === 0) ? (
            <EmptyState simple text={searchQuery ? "No SMS logs match your search." : "No SMS messages sent yet."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Phone</th>
                    <th className="pb-3 pr-4">Message</th>
                    <th className="pb-3 pr-4">Member</th>
                    <th className="pb-3 pr-4">Provider</th>
                    <th className="pb-3 pr-4">Queued</th>
                    <th className="pb-3 pr-4">Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          {statusIcon(log.status)}
                          {statusBadge(log.status)}
                        </div>
                        {log.error_message ? (
                          <p className="mt-0.5 text-xs text-red-500">{log.error_message.slice(0, 60)}</p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{maskPhone(log.to_phone)}</td>
                      <td className="py-3 pr-4 max-w-[200px]">
                        <p className="truncate text-muted-foreground" title={log.message}>{log.message.slice(0, 80)}</p>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {log.member_id ? (memberMap.get(log.member_id) ?? "—") : "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground capitalize">{log.provider}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {log.queued_at ? new Date(log.queued_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {log.delivered_at ? new Date(log.delivered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : log.sent_at ? new Date(log.sent_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <a key={i} href={`/admin/sms?page=${i + 1}${searchQuery ? `&q=${searchQuery}` : ""}`}
                className={`flex size-10 items-center justify-center rounded-md ${i + 1 === currentPage ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {i + 1}
              </a>
            ))}
          </div>
          <span className="text-muted-foreground">{count ?? 0} total</span>
        </nav>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Send SMS</h3>
            <p className="text-sm leading-6 text-muted-foreground">Send a test SMS message to verify delivery.</p>
          </CardHeader>
          <CardContent>
            <SmsComposeForm organizationId={organizationId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Integration Status</h3>
            <p className="text-sm leading-6 text-muted-foreground">MSG91 SMS gateway connection.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {integration ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={integration.status === "connected" ? "success" : "error"}>{integration.status}</Badge>
                </div>
                {integration.error_message ? (
                  <p className="text-red-500">{integration.error_message}</p>
                ) : null}
                {integration.last_sync_at ? (
                  <p className="text-muted-foreground">Last sync: {new Date(integration.last_sync_at).toLocaleString("en-IN")}</p>
                ) : null}
                <p className="text-muted-foreground">Configure MSG91 SMS from the organization settings portal.</p>
              </>
            ) : (
              <>
                <Badge variant="neutral">Not configured</Badge>
                <p className="text-muted-foreground">MSG91 SMS integration is not configured for this organization. Add it from the organization settings to enable SMS sending.</p>
              </>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              For bulk campaigns, use the <a href="/admin/communications" className="text-primary underline">Communication Hub</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
