import type { Database } from "./database";
import type { MemberRow, MembershipRow } from "./membership";

export const attendanceSessionStatuses = ["inside", "checked_out", "auto_closed", "void"] as const;
export type AttendanceSessionStatus = (typeof attendanceSessionStatuses)[number];

export const attendanceSources = ["reception", "qr", "member_app", "device", "system"] as const;
export type AttendanceSource = (typeof attendanceSources)[number];

export const accessDecisions = ["granted", "denied", "warning"] as const;
export type AccessDecision = (typeof accessDecisions)[number];

export type AttendanceSessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
export type AttendanceLogRow = Database["public"]["Tables"]["attendance_logs"]["Row"];
export type EntryEventRow = Database["public"]["Tables"]["entry_events"]["Row"];
export type ExitEventRow = Database["public"]["Tables"]["exit_events"]["Row"];
export type QrTokenRow = Database["public"]["Tables"]["qr_tokens"]["Row"];
export type AccessLogRow = Database["public"]["Tables"]["access_logs"]["Row"];
export type AttendanceAlertRow = Database["public"]["Tables"]["attendance_alerts"]["Row"];
export type AttendanceMetricRow = Database["public"]["Tables"]["attendance_metrics"]["Row"];
export type AccessDeviceRow = Database["public"]["Tables"]["access_devices"]["Row"];

export type AccessValidationResult = {
  allowed: boolean;
  reasonCode: string;
  message: string;
  member: MemberRow | null;
  membership: MembershipRow | null;
};

export type AttendanceDashboardMetrics = {
  todayCheckIns: number;
  currentInside: number;
  dailyAttendance: number;
  weeklyAttendance: number;
  monthlyAttendance: number;
  averageDuration: number;
  peakHour: number | null;
  capacityPercentage: number;
  inactive7Days: number;
  inactive15Days: number;
  inactive30Days: number;
};

export type AttendanceDashboardData = {
  metrics: AttendanceDashboardMetrics;
  currentSessions: Array<AttendanceSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null }>;
  recentSessions: Array<AttendanceSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null }>;
  hourlyTraffic: Array<{ hour: string; visits: number }>;
  dailyTrend: Array<{ date: string; visits: number; uniqueMembers: number }>;
  alerts: AttendanceAlertRow[];
  inactiveMembers: Array<Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> & { lastVisitAt: string | null; inactiveDays: number }>;
};

export type MemberAttendancePortal = {
  member: MemberRow;
  qrToken: QrTokenRow | null;
  qrSvg: string;
  qrPayload: string;
  activeSession: AttendanceSessionRow | null;
  locationTracking: {
    activeSessionId: string | null;
    branchId: string | null;
    branchName: string | null;
    enabled: boolean;
    radiusMeters: number;
    coordinatesConfigured: boolean;
  };
  metrics: {
    attendanceCount: number;
    lastVisitAt: string | null;
    currentStreak: number;
    monthlyVisits: number;
    averageDuration: number;
  };
  visits: AttendanceSessionRow[];
};

export type TrainerAttendanceView = {
  assignedMembers: Array<Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> & {
    visitCount: number;
    lastVisitAt: string | null;
    averageDuration: number;
    inactiveDays: number;
  }>;
  hourlyTraffic: Array<{ hour: string; visits: number }>;
};
