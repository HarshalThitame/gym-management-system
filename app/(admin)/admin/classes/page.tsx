import type { Metadata } from "next";
import { BarChart3, CalendarDays, Dumbbell, ListChecks, UsersRound } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric-tile";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { ClassBookingTrendChart, ClassUtilizationChart } from "@/features/classes/components/lazy-class-charts";
import { ClassCategoryForm, ClassDeleteForm, ClassForm, ClassScheduleForm, ClassSessionForm } from "@/features/classes/components/class-forms";
import { ClassStatusBadge } from "@/features/classes/components/class-status-badge";
import { formatClassLabel } from "@/features/classes/lib/business-rules";
import { getClassOperationsDashboard, listClassCategories, listClasses } from "@/features/classes/services/class-service";
import { listActiveTrainers } from "@/features/training/services/training-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

type AdminClassesPageProps = {
  searchParams: Promise<{ q?: string; status?: string; categoryId?: string; page?: string }>;
};

export const metadata: Metadata = createMetadata({
  title: "Class Management",
  description: "Manage group classes, schedules, bookings, waitlists, attendance, and class analytics.",
  path: "/admin/classes"
});

export default async function AdminClassesPage({ searchParams }: AdminClassesPageProps) {
  const scope = await requireGymAdminScope("/admin/classes");
  const params = await searchParams;
  const gymId = scope.gymId;
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "class_booking", actionName: "admin.classes.read" });
  const [dashboard, categories, classResult, trainers, planContext] = await Promise.all([
    getClassOperationsDashboard(gymId),
    listClassCategories(gymId),
    listClasses({ gymId, query: params.q, status: params.status, categoryId: params.categoryId, page: Number(params.page ?? "1"), pageSize: 40 }),
    listActiveTrainers(gymId),
    organizationId ? getOrgPlanContext(organizationId) : null
  ]);
  const activeClasses = classResult.classes.filter((classRow) => classRow.status === "active");
  const classSchedulingEnabled = planContext?.features.classBooking === true;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Class Operations</p>
          <h2 className="mt-2 text-3xl font-black">Classes, schedules, and group bookings</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Create class products, generate recurring sessions, manage trainers, track fill rates, and control booking capacity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/api/classes/reports?type=bookings" variant="secondary">Bookings CSV</ButtonLink>
          <ButtonLink href="/api/classes/reports?type=attendance&format=pdf" variant="secondary">Attendance PDF</ButtonLink>
          <ButtonLink href="/api/classes/reports?type=waitlists&format=excel" variant="secondary">Waitlist Excel</ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Configured class products" icon={<Dumbbell className="size-5" />} label="Classes" value={String(dashboard.metrics.totalClasses)} />
        <StatCard detail={`${dashboard.metrics.todaySessions} sessions today`} icon={<CalendarDays className="size-5" />} label="Upcoming" value={String(dashboard.metrics.upcomingSessions)} />
        <StatCard detail={`${dashboard.metrics.waitlistedMembers} waiting for seats`} icon={<UsersRound className="size-5" />} label="Bookings" value={String(dashboard.metrics.activeBookings)} />
        <StatCard detail="Average upcoming fill rate" icon={<BarChart3 className="size-5" />} label="Fill Rate" value={`${dashboard.metrics.averageFillRate}%`} />
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-5" method="get">
            <input className="h-11 rounded-md border border-border bg-surface px-3 md:col-span-2" name="q" placeholder="Search class name or description" defaultValue={params.q ?? ""} />
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="categoryId" defaultValue={params.categoryId ?? "all"}>
              <option value="all">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="status" defaultValue={params.status ?? "all"}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground" type="submit">Apply Filters</button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Class Directory</h3>
            <p className="text-sm leading-6 text-muted-foreground">Capacity, trainer assignment, access rules, and schedule readiness for each class.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {classResult.classes.map((classRow) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={classRow.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black">{classRow.name}</h4>
                      <ClassStatusBadge status={classRow.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{classRow.category?.name ?? "Uncategorized"} · {formatClassLabel(classRow.class_type)} · {formatClassLabel(classRow.difficulty)}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{classRow.description}</p>
                  </div>
                  <div className="shrink-0 text-sm font-bold text-muted-foreground">
                    {classRow.primaryTrainer?.display_name ?? "No trainer"}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                  <Metric label="Capacity" value={String(classRow.default_capacity)} />
                  <Metric label="Reserved" value={String(classRow.reserved_capacity)} />
                  <Metric label="Booking" value={`${classRow.booking_window_days}d`} />
                  <Metric label="Cancel" value={`${classRow.cancellation_window_hours}h`} />
                </div>
                <details className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <summary className="cursor-pointer text-xs font-black text-destructive">Delete Class</summary>
                  <div className="mt-2">
                    <ClassDeleteForm classId={classRow.id} />
                  </div>
                </details>
              </div>
            ))}
            {classResult.classes.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No classes match the current filters.</div> : null}
          </CardContent>
        </Card>
        
        {Math.ceil(classResult.total / classResult.pageSize) > 1 && (
          <Pagination 
            currentPage={classResult.page} 
            totalPages={Math.ceil(classResult.total / classResult.pageSize)} 
            baseHref="/admin/classes"
            totalItems={classResult.total}
          />
        )}

        <div className="space-y-5">
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Create Class</h3></CardHeader>
            <CardContent>
              {classSchedulingEnabled ? (
                <ClassForm categories={categories} trainers={trainers} />
              ) : (
                <FeatureLocked compact featureName="Class Creation" requiredPlan="Standard" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-2xl font-black">Class Category</h3></CardHeader>
            <CardContent>
              {classSchedulingEnabled ? (
                <ClassCategoryForm />
              ) : (
                <FeatureLocked compact featureName="Class Categories" requiredPlan="Standard" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Generate Recurring Sessions</h3>
            <p className="text-sm leading-6 text-muted-foreground">One-time, daily, weekly, monthly, and custom recurrence with trainer conflict checks.</p>
          </CardHeader>
          <CardContent>
            {classSchedulingEnabled ? (
              <ClassScheduleForm classes={activeClasses} />
            ) : (
              <FeatureLocked compact featureName="Recurring Class Schedules" requiredPlan="Standard" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Create One-Off Session</h3>
            <p className="text-sm leading-6 text-muted-foreground">Use for workshops, substitutions, holidays, special events, and manual calendar corrections.</p>
          </CardHeader>
          <CardContent>
            {classSchedulingEnabled ? (
              <ClassSessionForm classes={activeClasses} trainers={trainers} />
            ) : (
              <FeatureLocked compact featureName="One-Off Class Sessions" requiredPlan="Standard" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-2xl font-black">Capacity Utilization</h3></CardHeader>
          <CardContent><ClassUtilizationChart data={dashboard.utilization} /></CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-2xl font-black">Booking Trends</h3></CardHeader>
          <CardContent><ClassBookingTrendChart data={dashboard.bookingTrend} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="size-5" />
            <h3 className="text-2xl font-black">Upcoming Class Calendar</h3>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.sessions.map((session) => (
            <div className="rounded-lg border border-border bg-surface-muted p-4" key={session.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-black">{session.class?.name ?? "Class session"}</h4>
                <ClassStatusBadge status={session.status} />
              </div>
              <p className="mt-2 text-xs font-bold text-muted-foreground">{session.session_date} · {session.starts_at.slice(0, 5)}-{session.ends_at.slice(0, 5)}</p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{session.trainer?.display_name ?? "Trainer pending"} · {session.booked_count}/{session.capacity} booked · {session.waitlist_count} waiting</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
