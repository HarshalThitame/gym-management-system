import type { Database } from "./database";
import type { MemberRow } from "./membership";
import type { TrainerRow } from "./training";

export const appointmentStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;
export const appointmentTypes = ["consultation", "pt_session", "trial_session", "trainer_meeting", "follow_up", "general"] as const;

export type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

export type AppointmentWithDetails = AppointmentRow & {
  member: Pick<MemberRow, "id" | "full_name" | "phone" | "email" | "member_code"> | null;
  trainer: Pick<TrainerRow, "id" | "display_name" | "employee_code"> | null;
};

export type AppointmentDashboard = {
  metrics: {
    todayAppointments: number;
    todayCompleted: number;
    todayCancelled: number;
    todayNoShows: number;
    upcomingAppointments: number;
    pendingConfirmations: number;
  };
  today: AppointmentWithDetails[];
  upcoming: AppointmentWithDetails[];
  recent: AppointmentWithDetails[];
};
