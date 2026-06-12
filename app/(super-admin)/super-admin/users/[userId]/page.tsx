import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  Download,
  Globe,
  Lock,
  LogIn,
  Monitor,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserX
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { getUserDetailData } from "@/features/super-admin/services/user-management-service";
import type { UserActivityEvent, LoginHistoryEntry } from "@/features/super-admin/services/user-management-service";

type UserDetailPageProps = {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: UserDetailPageProps) {
  const { userId } = await params;
  return createMetadata({
    title: `User Detail: ${userId.slice(0, 8)}...`,
    description: "User activity timeline and login history.",
    path: "/super-admin/users"
  });
}

export default async function SuperAdminUserDetailPage({ params, searchParams }: UserDetailPageProps) {
  await requireRole(["super_admin"], "/super-admin/users");
  const { userId } = await params;
  const query = searchParams ? await searchParams : {};

  const loginPage = Number(stringParam(query.loginPage) ?? 1);
  const loginPageSize = Number(stringParam(query.loginPageSize) ?? 20);
  const activityPage = Number(stringParam(query.activityPage) ?? 1);
  const activityPageSize = Number(stringParam(query.activityPageSize) ?? 20);

  const data = await getUserDetailData(userId, loginPage, loginPageSize, activityPage, activityPageSize);

  if (!data) notFound();

  const { record, loginHistory, activityTimeline, loginHistoryPagination } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-black md:text-4xl">{record.user.full_name}</h1>
            <EnterpriseStatusBadge status={record.user.status} />
          </div>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {record.user.email ?? "No email"} · {record.user.phone ?? "No phone"} · Created {formatDate(record.user.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/api/super-admin/users/export?format=csv`} variant="secondary">
            <Download aria-hidden="true" className="size-4" />
            Export CSV
          </ButtonLink>
          <ButtonLink href="/super-admin/users" variant="secondary">Back to Users</ButtonLink>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<UserCheck className="size-5" />} label="Status" value={formatEnterpriseLabel(record.user.status)} />
        <StatCard icon={<ShieldCheck className="size-5" />} label="Roles" value={record.roles.map(formatEnterpriseLabel).join(", ") || "None"} />
        <StatCard icon={<LogIn className="size-5" />} label="Logins" value={formatCompactNumber(record.loginCount)} />
        <StatCard icon={<Activity className="size-5" />} label="Last Activity" value={record.lastActivityAt ? formatDateTime(record.lastActivityAt) : "No activity"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogIn aria-hidden="true" className="size-5 text-muted-foreground" />
                <h2 className="text-xl font-black">Login History</h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loginHistory.length > 0 ? loginHistory.map((entry) => (
              <LoginHistoryEntryCard key={entry.id} entry={entry} />
            )) : (
              <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No login history found.</p>
            )}
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Page {loginHistoryPagination.page} of {loginHistoryPagination.totalPages}</span>
              <div className="flex gap-2">
                <ButtonLink
                  aria-disabled={loginHistoryPagination.page <= 1}
                  href={`/super-admin/users/${userId}?loginPage=${loginHistoryPagination.page - 1}&activityPage=${activityPage}`}
                  size="sm"
                  variant="secondary">Previous</ButtonLink>
                <ButtonLink
                  aria-disabled={loginHistoryPagination.page >= loginHistoryPagination.totalPages}
                  href={`/super-admin/users/${userId}?loginPage=${loginHistoryPagination.page + 1}&activityPage=${activityPage}`}
                  size="sm"
                  variant="secondary">Next</ButtonLink>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity aria-hidden="true" className="size-5 text-muted-foreground" />
              <h2 className="text-xl font-black">Activity Timeline</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityTimeline.length > 0 ? activityTimeline.slice(0, 50).map((event) => (
              <ActivityEventCard key={`${event.source}-${event.id}`} event={event} />
            )) : (
              <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm font-semibold text-muted-foreground">No activity events found.</p>
            )}
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Showing {Math.min(50, activityTimeline.length)} of {formatCompactNumber(activityTimeline.length)} events</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck aria-hidden="true" className="size-5 text-muted-foreground" />
            <h2 className="text-xl font-black">Organization Access</h2>
          </div>
        </CardHeader>
        <CardContent>
          {record.organizations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {record.organizations.map((org) => (
                <div className="rounded-md border border-border bg-surface p-4" key={org.id}>
                  <p className="font-black">{org.name}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{org.slug}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">No organization access assigned.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoginHistoryEntryCard({ entry }: { entry: LoginHistoryEntry }) {
  const statusIcon = entry.status === "success" ? <UserCheck className="size-4 text-emerald-600" />
    : entry.status === "failed" ? <UserX className="size-4 text-red-600" />
    : entry.status === "locked" ? <Lock className="size-4 text-amber-600" />
    : <ShieldCheck className="size-4" />;

  const deviceType = entry.userAgent?.includes("Mobile") || entry.userAgent?.includes("Android") || entry.userAgent?.includes("iPhone")
    ? <Smartphone className="size-3" />
    : <Monitor className="size-3" />;

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
      <div className="flex items-start gap-3">
        {statusIcon}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black">{formatEnterpriseLabel(entry.status)}</span>
            <span className="text-xs font-semibold text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            {entry.ipAddress && <span className="flex items-center gap-1"><Globe className="size-3" />{entry.ipAddress}</span>}
            {deviceType}
            <span className="truncate max-w-[200px]">{entry.userAgent ?? "Unknown device"}</span>
          </div>
          {entry.failureReason && <p className="mt-1 text-xs text-red-600">{entry.failureReason}</p>}
        </div>
      </div>
    </div>
  );
}

function ActivityEventCard({ event }: { event: UserActivityEvent }) {
  const severityColor = event.severity === "critical" ? "text-red-600"
    : event.severity === "warning" ? "text-amber-600"
    : event.severity === "notice" ? "text-blue-600"
    : "text-muted-foreground";

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs font-black uppercase tracking-[0.12em] ${severityColor}`}>{formatEnterpriseLabel(event.severity)}</span>
        <EnterpriseStatusBadge status={event.source} />
        <span className="text-sm font-black">{formatEnterpriseLabel(event.action)}</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {formatDateTime(event.createdAt)} · {event.entityType} · {event.entityId ?? "N/A"}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Metadata</summary>
        <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-surface p-2 text-xs text-muted-foreground">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-bold break-all">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
