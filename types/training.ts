import type { Database } from "./database";
import type { MemberRow } from "./membership";

export const trainerStatuses = ["active", "inactive", "on_leave", "archived"] as const;
export type TrainerStatus = (typeof trainerStatuses)[number];

export const trainerSpecializations = [
  "weight_loss",
  "muscle_building",
  "strength_training",
  "powerlifting",
  "bodybuilding",
  "hiit",
  "crossfit",
  "yoga",
  "functional_training",
  "senior_fitness",
  "sports_conditioning",
  "rehabilitation"
] as const;
export type TrainerSpecialization = (typeof trainerSpecializations)[number];

export const assignmentStatuses = ["active", "paused", "ended"] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];

export const sessionStatuses = ["scheduled", "completed", "missed", "cancelled", "rescheduled"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const workoutDifficulties = ["beginner", "intermediate", "advanced", "elite"] as const;
export type WorkoutDifficulty = (typeof workoutDifficulties)[number];

export type TrainerRow = Database["public"]["Tables"]["trainers"]["Row"];
export type TrainerProfileRow = Database["public"]["Tables"]["trainer_profiles"]["Row"];
export type TrainerSpecializationRow = Database["public"]["Tables"]["trainer_specializations"]["Row"];
export type TrainerCertificationRow = Database["public"]["Tables"]["trainer_certifications"]["Row"];
export type TrainerAvailabilityRow = Database["public"]["Tables"]["trainer_availability"]["Row"];
export type TrainerAssignmentRow = Database["public"]["Tables"]["trainer_assignments"]["Row"];
export type PersonalTrainingPackageRow = Database["public"]["Tables"]["personal_training_packages"]["Row"];
export type MemberPtPackageRow = Database["public"]["Tables"]["member_pt_packages"]["Row"];
export type TrainerSessionRow = Database["public"]["Tables"]["trainer_sessions"]["Row"];
export type TrainerNoteRow = Database["public"]["Tables"]["trainer_notes"]["Row"];
export type WorkoutProgramRow = Database["public"]["Tables"]["workout_programs"]["Row"];
export type WorkoutProgramExerciseRow = Database["public"]["Tables"]["workout_program_exercises"]["Row"];
export type WorkoutProgramAssignmentRow = Database["public"]["Tables"]["workout_program_assignments"]["Row"];
export type TrainerFeedbackRow = Database["public"]["Tables"]["trainer_feedback"]["Row"];
export type StaffProfileRow = Database["public"]["Tables"]["staff_profiles"]["Row"];

export type TrainerDirectoryItem = TrainerRow & {
  profile: TrainerProfileRow | null;
  specializations: TrainerSpecializationRow[];
  certifications: TrainerCertificationRow[];
  activeAssignments: number;
  upcomingSessions: number;
  completedSessions: number;
  averageRating: number;
};

export type TrainerProfileBundle = {
  trainer: TrainerRow;
  profile: TrainerProfileRow | null;
  specializations: TrainerSpecializationRow[];
  certifications: TrainerCertificationRow[];
  availability: TrainerAvailabilityRow[];
  assignments: Array<TrainerAssignmentRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "email" | "phone"> | null }>;
  sessions: Array<TrainerSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null }>;
  programs: WorkoutProgramRow[];
  notes: TrainerNoteRow[];
  feedback: TrainerFeedbackRow[];
};

export type TrainerDashboardMetrics = {
  assignedMembers: number;
  todaySessions: number;
  upcomingSessions: number;
  completedSessions: number;
  pendingSessions: number;
  ptRevenue: number;
  averageRating: number;
};

export type TrainerDashboardData = {
  trainer: TrainerRow | null;
  metrics: TrainerDashboardMetrics;
  assignedMembers: Array<MemberRow & { assignment: TrainerAssignmentRow | null }>;
  todaysSessions: Array<TrainerSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null }>;
  upcomingSessions: Array<TrainerSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null }>;
};

export type MemberTrainingPortal = {
  member: MemberRow;
  trainer: TrainerRow | null;
  packages: MemberPtPackageRow[];
  sessions: Array<TrainerSessionRow & { trainer: Pick<TrainerRow, "id" | "display_name" | "photo_url"> | null }>;
  programs: Array<WorkoutProgramAssignmentRow & {
    program: WorkoutProgramRow | null;
    exercises: WorkoutProgramExerciseRow[];
  }>;
  notes: TrainerNoteRow[];
};
