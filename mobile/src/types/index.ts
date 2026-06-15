export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export const ROLE_NAMES = ["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer", "member"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export function isRoleName(value: string): value is RoleName {
  return ROLE_NAMES.includes(value as RoleName);
}

export const PERMISSION_ACTIONS = ["read", "create", "update", "delete", "export", "approve"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const AUTH_RESOURCES = [
  "users", "roles", "profiles", "members", "trainers",
  "membership_plans", "memberships", "payments", "attendance",
  "classes", "class_bookings", "leads", "notifications",
  "reports", "settings", "organizations", "branches",
  "feature_flags", "licenses", "compliance", "backups",
  "system_health", "content", "audit_logs"
] as const;
export type AuthResource = (typeof AUTH_RESOURCES)[number];

export type ProfileStatus = "active" | "invited" | "suspended" | "archived";

export interface AuthProfile {
  id: string;
  gym_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: ProfileStatus;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export interface AuthContext {
  userId: string | null;
  email: string | null;
  profile: AuthProfile | null;
  organizationId: string | null;
  roles: RoleName[];
  primaryRole: RoleName | null;
  isAuthenticated: boolean;
  isActive: boolean;
}

export type OrganizationType = "single_gym" | "multi_branch" | "franchise";
export type OrganizationStatus = "active" | "trial" | "suspended" | "deactivated" | "archived";
export type GymStatus = "active" | "suspended" | "archived";
export type BranchStatus = "planned" | "active" | "maintenance" | "suspended" | "deactivated" | "archived";
export type BranchRole = "owner" | "admin" | "manager" | "staff" | "trainer" | "viewer";
export type AccessScope = "single_branch" | "multi_branch" | "organization";
export type PlanTier = "starter" | "professional" | "enterprise";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  organization_type: OrganizationType;
  status: OrganizationStatus;
  primary_domain: string | null;
  billing_email: string | null;
  owner_user_id: string | null;
  settings: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Gym {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  status: GymStatus;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  gym_id: string | null;
  name: string;
  slug: string;
  branch_code: string;
  status: BranchStatus;
  timezone: string;
  currency: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  operating_hours: Json;
  capacity: number;
  latitude: number | null;
  longitude: number | null;
  opened_on: string | null;
  metadata: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BranchUser {
  id: string;
  organization_id: string;
  branch_id: string;
  user_id: string;
  role_name: RoleName;
  branch_role: BranchRole;
  access_scope: AccessScope;
  status: "active" | "invited" | "suspended" | "revoked";
  permissions: Json;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantConfig {
  id: string;
  organization_id: string;
  tenant_key: string;
  plan_tier: PlanTier;
  status: "active" | "trial" | "suspended" | "archived";
  custom_domain: string | null;
  subdomain: string | null;
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  typography: Json;
  email_branding: Json;
  domain_status: "not_configured" | "pending" | "verified" | "failed";
  feature_overrides: Json;
  limits: Json;
  compliance_settings: Json;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: string;
  name: string;
  description: string | null;
  max_members: number;
  max_branches: number;
  qr_attendance_enabled: boolean;
  biometric_attendance_enabled: boolean;
  rfid_attendance_enabled: boolean;
  class_scheduling_enabled: boolean;
  trainer_assignment_enabled: boolean;
  razorpay_enabled: boolean;
  communications_enabled: boolean;
  ai_enabled: boolean;
  advanced_reports_enabled: boolean;
  custom_domain_enabled: boolean;
  api_access_enabled: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  package_id: string;
  status: "active" | "trial" | "expired" | "suspended" | "cancelled";
  trial_ends_at: string | null;
  started_at: string;
  expires_at: string | null;
  assigned_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSubscription {
  id: string;
  organization_id: string;
  plan_tier: PlanTier;
  status: "trial" | "active" | "past_due" | "cancelled" | "suspended";
  branch_limit: number;
  member_limit: number;
  staff_limit: number;
  storage_limit_mb: number;
  starts_on: string;
  renews_on: string | null;
  trial_ends_on: string | null;
  usage_snapshot: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipPlan {
  id: string;
  organization_id: string;
  branch_id: string;
  name: string;
  description: string | null;
  plan_type: "monthly" | "quarterly" | "half_yearly" | "annual" | "custom";
  duration_days: number;
  price: number;
  discounted_price: number | null;
  access_level: "basic" | "standard" | "premium" | "elite" | "custom";
  features: Json;
  status: "draft" | "active" | "archived";
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string | null;
  member_code: string;
  full_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  date_of_birth: string | null;
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
  status: "active" | "inactive" | "suspended" | "archived";
  joined_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string | null;
  member_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  discount_amount: number;
  paid_amount: number;
  status: "pending" | "active" | "expired" | "cancelled" | "frozen" | "suspended";
  auto_renew: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSession {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string | null;
  member_id: string;
  check_in_at: string;
  check_out_at: string | null;
  method: "qr" | "manual" | "biometric" | "rfid";
  status: "active" | "completed";
  created_at: string;
}

export interface Lead {
  id: string;
  gym_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  source: "free_trial" | "membership_inquiry" | "contact";
  interest: string | null;
  message: string;
  preferred_trial_at: string | null;
  status: "new" | "contacted" | "trial_scheduled" | "trial_completed" | "converted" | "lost" | "spam";
  consent_marketing: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: string;
  organization_id: string;
  gym_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  bio: string | null;
  photo_url: string | null;
  status: "active" | "inactive" | "suspended" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainerAssignment {
  id: string;
  organization_id: string;
  gym_id: string;
  trainer_id: string;
  member_id: string;
  status: "active" | "completed" | "cancelled";
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface TrainerSession {
  id: string;
  organization_id: string;
  gym_id: string;
  trainer_id: string;
  member_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  trainer_id: string | null;
  capacity: number;
  start_time: string;
  end_time: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  days_of_week: number[];
  status: "active" | "cancelled" | "completed";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassBooking {
  id: string;
  organization_id: string;
  gym_id: string;
  class_id: string;
  member_id: string;
  status: "booked" | "cancelled" | "attended" | "no_show" | "waitlisted";
  booked_at: string;
  created_at: string;
}

export interface Payment {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string | null;
  member_id: string | null;
  payment_number: string;
  amount: number;
  payment_method: "cash" | "upi" | "credit_card" | "debit_card" | "net_banking" | "razorpay";
  payment_type: "membership_purchase" | "membership_renewal" | "registration_fee" | "personal_training" | "class_fee" | "other";
  status: "pending" | "processing" | "paid" | "failed" | "refunded" | "partially_refunded" | "cancelled";
  paid_at: string | null;
  collected_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  gym_id: string;
  branch_id: string | null;
  member_id: string | null;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled" | "refunded";
  due_date: string | null;
  issued_at: string;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  organization_id: string | null;
  branch_id: string | null;
  user_id: string;
  title: string;
  body: string;
  type: "renewal" | "attendance" | "class" | "payment" | "trainer" | "system" | "promotion";
  priority: "low" | "normal" | "high" | "urgent";
  read: boolean;
  action_url: string | null;
  metadata: Json;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  organization_id: string | null;
  branch_id: string | null;
  actor_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  severity: "info" | "notice" | "warning" | "critical";
  metadata: Json;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface WorkoutProgram {
  id: string;
  organization_id: string;
  gym_id: string;
  trainer_id: string | null;
  member_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "paused";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutLog {
  id: string;
  program_id: string;
  member_id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight: number | null;
  duration_minutes: number | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
}

export interface NutritionPlan {
  id: string;
  organization_id: string;
  gym_id: string;
  trainer_id: string | null;
  member_id: string;
  name: string;
  description: string | null;
  daily_calories: number | null;
  meals: Json;
  status: "active" | "completed" | "paused";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FitnessProgress {
  id: string;
  member_id: string;
  weight_kg: number | null;
  body_fat_percentage: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  biceps_cm: number | null;
  thigh_cm: number | null;
  photo_urls: string[];
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
}

export interface MemberDashboard {
  currentMembership: Membership | null;
  currentPlan: MembershipPlan | null;
  activeWorkoutPrograms: number;
  activeNutritionPlan: NutritionPlan | null;
  todayCheckIns: number;
  bookedClasses: number;
  activeWaitlists: number;
  upcomingPtSessions: number;
  unreadNotifications: number;
  attendanceStreak: number;
  workoutStreak: number;
  completedWorkouts: number;
  caloriesToday: number;
  waterToday: number;
  lastVisitAt: string | null;
}

export interface TrainerDashboard {
  trainer: Trainer | null;
  todaySessions: TrainerSession[];
  assignedMembers: Member[];
  upcomingSessions: number;
  metrics: {
    todaySessions: number;
    assignedMembers: number;
    upcomingSessions: number;
    completedToday: number;
  };
}

export type MembershipStatus = "pending" | "active" | "expired" | "cancelled" | "frozen" | "suspended";
export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded" | "partially_refunded" | "cancelled";
export type AttendanceMethod = "qr" | "manual" | "biometric" | "rfid";
export type NotificationType = "renewal" | "attendance" | "payment" | "class" | "trainer" | "system" | "promotion" | "announcement" | "campaign" | "lead";

export interface AttendanceValidationResult {
  ok: boolean;
  error?: string;
  code?: string;
  memberId?: string;
  gymId?: string;
  organizationId?: string;
  branchId?: string | null;
}

export interface AttendanceAnalytics {
  daily: { date: string; count: number }[];
  weekly: { week: string; count: number }[];
  monthly: { month: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  memberRetention: number;
  averageDaily: number;
  busiestDay: string;
  slowestDay: string;
  totalSessions: number;
}

export interface MemberAttendanceProfile {
  totalVisits: number;
  currentStreak: number;
  longestStreak: number;
  monthlyAverage: number;
  attendancePercent: number;
  preferredTime: string;
  lastVisit: string | null;
  daysSinceLastVisit: number;
  rank: number;
}

export interface AttendanceBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
  type: "streak" | "total" | "monthly" | "special";
  earned: boolean;
  earnedAt?: string;
}

export interface LeaderboardEntry {
  memberId: string;
  fullName: string;
  memberCode: string;
  currentStreak: number;
  totalVisits: number;
  attendancePercent: number;
  rank: number;
}
