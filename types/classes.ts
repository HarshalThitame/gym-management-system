import type { Database } from "./database";
import type { MemberRow, MembershipRow } from "./membership";
import type { TrainerRow } from "./training";

export const classCategoryNames = [
  "yoga",
  "zumba",
  "hiit",
  "crossfit",
  "strength_training",
  "pilates",
  "functional_training",
  "cardio_sessions",
  "bootcamp",
  "group_pt",
  "workshops",
  "special_events"
] as const;

export const classSessionStatuses = ["scheduled", "in_progress", "completed", "cancelled", "closed"] as const;
export const classBookingStatuses = ["booked", "checked_in", "attended", "absent", "cancelled", "no_show"] as const;
export const classWaitlistStatuses = ["waiting", "promoted", "expired", "cancelled"] as const;
export const classAttendanceStatuses = ["attended", "absent", "cancelled", "late"] as const;

export type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
export type ClassCategoryRow = Database["public"]["Tables"]["class_categories"]["Row"];
export type ClassTrainerRow = Database["public"]["Tables"]["class_trainers"]["Row"];
export type ClassScheduleRow = Database["public"]["Tables"]["class_schedules"]["Row"];
export type ClassScheduleExceptionRow = Database["public"]["Tables"]["class_schedule_exceptions"]["Row"];
export type ClassSessionRow = Database["public"]["Tables"]["class_sessions"]["Row"];
export type ClassBookingRow = Database["public"]["Tables"]["class_bookings"]["Row"];
export type ClassWaitlistRow = Database["public"]["Tables"]["class_waitlists"]["Row"];
export type ClassAttendanceRow = Database["public"]["Tables"]["class_attendance"]["Row"];
export type ClassSessionLogRow = Database["public"]["Tables"]["class_session_logs"]["Row"];
export type ClassNotificationEventRow = Database["public"]["Tables"]["class_notification_events"]["Row"];

export type ClassWithCategory = ClassRow & {
  category: Pick<ClassCategoryRow, "id" | "name" | "slug" | "color_token"> | null;
  primaryTrainer: Pick<TrainerRow, "id" | "display_name" | "employee_code"> | null;
};

export type ClassSessionWithClass = ClassSessionRow & {
  class: Pick<ClassRow, "id" | "name" | "difficulty" | "duration_minutes" | "cancellation_window_hours" | "membership_access" | "price_amount" | "requires_approval"> | null;
  category: Pick<ClassCategoryRow, "id" | "name" | "color_token"> | null;
  trainer: Pick<TrainerRow, "id" | "display_name" | "employee_code"> | null;
};

export type ClassBookingWithSession = ClassBookingRow & {
  session: ClassSessionWithClass | null;
};

export type ClassWaitlistWithSession = ClassWaitlistRow & {
  session: ClassSessionWithClass | null;
};

export type ClassOperationsDashboard = {
  metrics: {
    totalClasses: number;
    upcomingSessions: number;
    todaySessions: number;
    activeBookings: number;
    waitlistedMembers: number;
    averageFillRate: number;
  };
  classes: ClassWithCategory[];
  sessions: ClassSessionWithClass[];
  utilization: Array<{ className: string; fillRate: number; booked: number; capacity: number }>;
  bookingTrend: Array<{ date: string; bookings: number; cancellations: number }>;
  popularClasses: Array<{ className: string; sessions: number; fillRate: number }>;
};

export type MemberClassesPortal = {
  member: MemberRow;
  availableSessions: ClassSessionWithClass[];
  bookings: ClassBookingWithSession[];
  waitlists: ClassWaitlistWithSession[];
  attendance: ClassAttendanceRow[];
};

export type TrainerClassesPortal = {
  trainer: TrainerRow | null;
  sessions: ClassSessionWithClass[];
  bookings: ClassBookingRow[];
  utilization: Array<{ className: string; fillRate: number; attended: number }>;
};

export type ClassEligibilityResult = {
  allowed: boolean;
  reasonCode: string;
  message: string;
  membership: MembershipRow | null;
};
