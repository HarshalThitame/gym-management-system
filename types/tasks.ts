import type { Database } from "./database";

export const taskStatuses = ["pending", "in_progress", "completed", "cancelled"] as const;
export const taskPriorities = ["low", "medium", "high", "urgent"] as const;
export const taskTypes = ["follow_up", "renewal", "payment", "appointment", "general"] as const;

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export type TaskDashboard = {
  metrics: {
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedToday: number;
    overdueTasks: number;
    myTasks: number;
  };
  pending: TaskRow[];
  inProgress: TaskRow[];
  completed: TaskRow[];
};
