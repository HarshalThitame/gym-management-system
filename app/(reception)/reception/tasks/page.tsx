import type { Metadata } from "next";
import { CheckCircle, Clock, ListChecks, PlayCircle, AlertTriangle, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { getTaskDashboard } from "@/features/tasks/services/task-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { TaskForm, TaskPriorityBadge, TaskStatusBadge, TaskTypeBadge } from "@/features/tasks/components/task-forms";
import { completeTaskAction, startTaskAction } from "@/features/tasks/actions/task-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Tasks",
  description: "Manage front desk tasks, follow-ups, and daily work queue for assigned branch.",
  path: "/reception/tasks"
});

export default async function ReceptionTasksPage() {
  const scope = await requireReceptionScope("/reception/tasks");
  const dashboard = await getTaskDashboard(scope.gymId, scope.userId);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Tasks</p>
        <h2 className="mt-2 text-3xl font-black">Task management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage assigned tasks, follow-ups, renewals, payment reminders, and daily work queue for the front desk.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard detail="Pending tasks" icon={<ListChecks className="size-5" />} label="Pending" value={String(dashboard.metrics.pendingTasks)} />
        <StatCard detail="In progress" icon={<PlayCircle className="size-5" />} label="In Progress" value={String(dashboard.metrics.inProgressTasks)} />
        <StatCard detail="Completed today" icon={<CheckCircle className="size-5" />} label="Completed Today" value={String(dashboard.metrics.completedToday)} />
        <StatCard detail="My assigned tasks" icon={<UserCheck className="size-5" />} label="My Tasks" value={String(dashboard.metrics.myTasks)} />
        <StatCard detail="Past due date" icon={<AlertTriangle className="size-5" />} label="Overdue" value={String(dashboard.metrics.overdueTasks)} />
        <StatCard detail="Total tasks" icon={<Clock className="size-5" />} label="Total" value={String(dashboard.metrics.totalTasks)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Create Task</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Add a new task to your front desk work queue.
            </p>
          </CardHeader>
          <CardContent>
            <TaskForm />
          </CardContent>
        </Card>

        <section className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Pending Tasks</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.pending.map((task) => (
                <div className="rounded-md border border-border bg-surface p-4" key={task.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{task.title}</p>
                        <TaskPriorityBadge priority={task.priority} />
                        <TaskTypeBadge type={task.type} />
                      </div>
                      {task.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{task.description.slice(0, 100)}</p>
                      ) : null}
                      {task.due_date ? (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Due: {new Date(task.due_date).toLocaleString("en-IN")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <form action={startTaskAction}>
                        <input name="taskId" type="hidden" value={task.id} />
                        <Button size="sm" type="submit" variant="accent">Start</Button>
                      </form>
                      <form action={completeTaskAction}>
                        <input name="taskId" type="hidden" value={task.id} />
                        <Button size="sm" type="submit" variant="success">Complete</Button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
              {dashboard.pending.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
                  No pending tasks.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Recently Completed</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.completed.map((task) => (
                <div className="rounded-md border border-border bg-surface-muted p-4" key={task.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{task.title}</p>
                        <TaskTypeBadge type={task.type} />
                        <TaskStatusBadge status={task.status} />
                      </div>
                      {task.completed_at ? (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Completed: {new Date(task.completed_at).toLocaleString("en-IN")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {dashboard.completed.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">
                  No completed tasks yet.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </section>
    </div>
  );
}
