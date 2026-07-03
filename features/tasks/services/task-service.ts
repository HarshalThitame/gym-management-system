import { addDays, formatISO, startOfDay, endOfDay } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TaskRow, TaskDashboard } from "@/types/tasks";

export async function getTaskDashboard(gymId: string, userId: string): Promise<TaskDashboard> {
  const supabase = await createSupabaseServerClient();
  const today = formatISO(new Date(), { representation: "date" });
  const tomorrow = formatISO(addDays(new Date(), 1), { representation: "date" });

  const [
    totalResult,
    pendingResult,
    inProgressResult,
    completedTodayResult,
    overdueResult,
    myTasksResult,
    pendingList,
    inProgressList,
    completedList
  ] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "pending"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "in_progress"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "completed").gte("completed_at", `${today}T00:00:00.000Z`).lte("completed_at", `${tomorrow}T00:00:00.000Z`),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("gym_id", gymId).in("status", ["pending", "in_progress"]).lt("due_date", new Date().toISOString()),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("assigned_to", userId),
    supabase.from("tasks").select("*").eq("gym_id", gymId).eq("status", "pending").order("priority", { ascending: false }).order("due_date", { ascending: true }).limit(20),
    supabase.from("tasks").select("*").eq("gym_id", gymId).eq("status", "in_progress").order("updated_at", { ascending: false }).limit(10),
    supabase.from("tasks").select("*").eq("gym_id", gymId).eq("status", "completed").order("completed_at", { ascending: false }).limit(10)
  ]);

  const firstError = [
    totalResult, pendingResult, inProgressResult, completedTodayResult,
    overdueResult, myTasksResult, pendingList, inProgressList, completedList
  ].find((r) => r.error)?.error;

  if (firstError) throw new Error(firstError.message);

  return {
    metrics: {
      totalTasks: totalResult.count ?? 0,
      pendingTasks: pendingResult.count ?? 0,
      inProgressTasks: inProgressResult.count ?? 0,
      completedToday: completedTodayResult.count ?? 0,
      overdueTasks: overdueResult.count ?? 0,
      myTasks: myTasksResult.count ?? 0
    },
    pending: (pendingList.data ?? []) as TaskRow[],
    inProgress: (inProgressList.data ?? []) as TaskRow[],
    completed: (completedList.data ?? []) as TaskRow[]
  };
}
