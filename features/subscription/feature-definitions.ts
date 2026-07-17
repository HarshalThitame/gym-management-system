export type FeatureCategory = {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: FeatureDefinition[];
};

export type FeatureDefinition = {
  key: string;
  label: string;
  description: string;
  featureCode: string;
  upgradeLabel?: string;
  limitKey?: string;
  limitLabel?: string;
  isNewInGrowth?: boolean;
  isNewInEnterprise?: boolean;
  isUnlimited?: boolean;
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: "members",
    name: "Members & Access",
    description: "Member management, check-in, and access control features",
    icon: "Users",
    features: [
      { key: "memberManagement", label: "Member profiles", description: "Full name, photo, DOB, contact, emergency contact, health notes, custom fields", featureCode: "member_management", limitKey: "max_members", limitLabel: "Unlimited on Enterprise" },
      { key: "qrAttendanceEnabled", label: "QR code check-in", description: "Members can scan QR from their profile or printed card at entry gate", featureCode: "qr_attendance" },
      { key: "manualAttendance", label: "Manual check-in", description: "Staff can mark attendance manually from admin dashboard", featureCode: "manual_attendance" },
      { key: "expiryTracking", label: "Member status tracking", description: "Active, Expired, Paused, Frozen — maintain status change history", featureCode: "expiry_tracking" },
      { key: "membershipPauseFreeze", label: "Membership pause / freeze", description: "Pause memberships for travel or injury. Auto-resume on selected date", featureCode: "membership_pause_freeze" },
      { key: "biometricAttendanceEnabled", label: "Biometric check-in", description: "Fingerprint scanner integration at entry gate", featureCode: "biometric_attendance", isNewInGrowth: true },
      { key: "multiBranchManagement", label: "Multi-gym access", description: "Members can check in at any gym", featureCode: "multi_branch_management", isNewInGrowth: true },
      { key: "crossBranchMemberAccess", label: "Cross-gym member access", description: "Members can check in at any gym location", featureCode: "cross_branch_member_access", isNewInEnterprise: true },
      { key: "memberTaggingSegments", label: "Member tagging & segments", description: "Tags for targeted communication", featureCode: "member_tagging_segments", isNewInGrowth: true },
      { key: "customMemberFields", label: "Custom member fields", description: "Add unlimited custom profile fields", featureCode: "custom_member_fields", isNewInEnterprise: true },
      { key: "memberDataImportExport", label: "Member data import / export", description: "Bulk import from CSV, migration support, full data export", featureCode: "member_data_import_export", isNewInEnterprise: true },
    ],
  },
  {
    id: "billing",
    name: "Membership Plans & Billing",
    description: "Plan creation, payments, invoicing, and billing automation",
    icon: "CreditCard",
    features: [
      { key: "memberManagement", label: "Membership plan builder", description: "Create unlimited monthly, quarterly, annual, day-pass, and custom plans", featureCode: "member_management", limitKey: "membership_plan_types", limitLabel: "Unlimited on Enterprise" },
      { key: "paymentTracking", label: "Cash, UPI & online payments", description: "All payment modes with auto-reconciliation dashboard", featureCode: "payment_tracking" },
      { key: "onlinePaymentLinks", label: "Online payment link", description: "Generate Razorpay one-time links", featureCode: "online_payment_links" },
      { key: "renewalReminders", label: "Renewal reminders", description: "Auto reminder before expiry via SMS/WhatsApp", featureCode: "renewal_reminders" },
      { key: "billingInvoices", label: "GST invoices & PDF receipts", description: "Full GST-compliant invoice, auto-generated, delivered via email and WhatsApp", featureCode: "billing_invoices" },
      { key: "autoBilling", label: "Auto-billing & recurring charges", description: "NACH mandate or card-on-file auto-debit", featureCode: "auto_billing", isNewInGrowth: true },
      { key: "discountPromoCodes", label: "Discount & promo codes", description: "Fixed or percentage discount with expiry", featureCode: "discount_promo_codes", isNewInGrowth: true },
      { key: "paymentFailureHandling", label: "Payment failure handling", description: "Auto-retry failed auto-debits, notify on failure", featureCode: "payment_failure_handling", isNewInGrowth: true },
      { key: "partialPaymentDues", label: "Partial payment & dues tracking", description: "Record partial payment, track outstanding balance", featureCode: "partial_payment_dues", isNewInGrowth: true },
      { key: "corporateBulkMemberships", label: "Corporate / bulk memberships", description: "Company tie-ups for employee memberships, company-level invoicing", featureCode: "corporate_bulk_memberships", isNewInEnterprise: true },
      { key: "multiGstinSupport", label: "Multi-GSTIN support", description: "Each gym can have its own GST number", featureCode: "multi_gstin_support", isNewInEnterprise: true },
      { key: "branchRevenueSplit", label: "Revenue split across gyms", description: "Track and split collections per gym for P&L", featureCode: "branch_revenue_split", isNewInEnterprise: true },
      { key: "receipts", label: "Payment receipts", description: "Generate and send payment receipts to members", featureCode: "receipts" },
    ],
  },
  {
    id: "classes",
    name: "Class Scheduling",
    description: "Timetable management, capacity control, and member booking",
    icon: "Calendar",
    features: [
      { key: "classBooking", label: "Unlimited class slots", description: "No cap on recurring class slots", featureCode: "class_booking", limitKey: "weekly_classes", limitLabel: "Unlimited" },
      { key: "classBooking", label: "Class capacity control", description: "Set maximum seats, auto-close when full", featureCode: "class_booking" },
      { key: "memberPortal", label: "Member self-booking", description: "Members browse and book available classes", featureCode: "member_portal" },
      { key: "classBooking", label: "Class cancellation by admin", description: "Admin can cancel class, notify enrolled members", featureCode: "class_booking" },
      { key: "waitlistManagement", label: "Waitlist management", description: "Auto-promote next member after cancellation", featureCode: "waitlist_management", isNewInGrowth: true },
      { key: "ptSessions", label: "PT session booking", description: "1-on-1 sessions with specific trainers", featureCode: "pt_sessions", isNewInGrowth: true },
      { key: "classAttendanceTracking", label: "Class attendance tracking", description: "Mark attended vs no-show", featureCode: "class_attendance_tracking", isNewInGrowth: true },
      { key: "crossBranchClassBooking", label: "Cross-gym class booking", description: "Members attend classes at any gym", featureCode: "cross_branch_class_booking", isNewInEnterprise: true },
      { key: "networkWideClassCalendar", label: "Network-wide class calendar", description: "Unified class schedule across all gyms", featureCode: "network_wide_class_calendar", isNewInEnterprise: true },
      { key: "trainerSharingAcrossBranches", label: "Trainer sharing across gyms", description: "Assign trainer to multiple gyms with conflict prevention", featureCode: "trainer_sharing_across_branches", isNewInEnterprise: true },
    ],
  },
  {
    id: "staff",
    name: "Staff & Trainer Management",
    description: "Staff accounts, roles, trainer profiles, and HR tools",
    icon: "Briefcase",
    features: [
      { key: "staffManagement", label: "Staff accounts", description: "Create logins for all staff types", featureCode: "staff_management", limitKey: "max_staff", limitLabel: "Unlimited on Enterprise" },
      { key: "roleBasedPermissions", label: "Role-based permissions", description: "Admin, Manager, Trainer, Receptionist roles", featureCode: "role_based_permissions", isNewInGrowth: true },
      { key: "trainerManagement", label: "Trainer profile", description: "Bio, certifications, photo on member portal", featureCode: "trainer_management" },
      { key: "trainerCommissionsPayroll", label: "Trainer commission tracking", description: "Auto-calculate earnings per PT session or class", featureCode: "trainer_commissions_payroll", isNewInGrowth: true },
      { key: "payrollExport", label: "Payroll export", description: "Export salary and commission report as CSV/PDF", featureCode: "payroll_export", isNewInGrowth: true },
      { key: "workoutAssignment", label: "Workout assignment", description: "Assign workout plans to members from trainer dashboard", featureCode: "workout_assignment", isNewInGrowth: true },
      { key: "nutritionPlans", label: "Nutrition plans", description: "Create and assign diet/nutrition plans to members", featureCode: "nutrition_plans", isNewInGrowth: true },
      { key: "customRolesGranularPermissions", label: "Custom roles & granular permissions", description: "Build custom roles: Gym Head, Franchise Manager, Regional Manager", featureCode: "custom_roles_granular_permissions", isNewInEnterprise: true },
      { key: "staffAttendanceLeaveTracking", label: "Staff attendance & leave tracking", description: "Clock-in/out, leave requests, monthly attendance reports", featureCode: "staff_attendance_leave", isNewInEnterprise: true },
      { key: "multiBranchStaffAssignment", label: "Multi-gym staff assignment", description: "Assign staff to one or multiple gyms", featureCode: "multi_branch_staff_assignment", isNewInEnterprise: true },
      { key: "hrDocumentStorage", label: "HR document storage", description: "Upload contracts, certificates, ID proofs", featureCode: "hr_document_storage", isNewInEnterprise: true },
    ],
  },
  {
    id: "communication",
    name: "Communication & CRM",
    description: "Member notifications, CRM, broadcasts, and marketing automation",
    icon: "MessageSquare",
    features: [
      { key: "whatsappIntegration", label: "WhatsApp & SMS notifications", description: "All system-triggered messages", featureCode: "whatsapp_integration" },
      { key: "smsIntegration", label: "SMS alerts", description: "OTP, renewal reminders, check-in confirmation", featureCode: "sms_integration", limitKey: "sms_monthly", limitLabel: "Unlimited on Enterprise" },
      { key: "birthdayGreetings", label: "Birthday greetings", description: "Auto WhatsApp on member birthday", featureCode: "birthday_greetings" },
      { key: "broadcastMessages", label: "WhatsApp broadcast", description: "Bulk messages to all members or segments", featureCode: "broadcast_messages", isNewInGrowth: true },
      { key: "emailCampaigns", label: "Email campaigns", description: "Templates for offers, renewals, events", featureCode: "email_campaigns", isNewInGrowth: true },
      { key: "customEmailDomain", label: "Custom email domain", description: "Send emails from your own domain via DNS verification", featureCode: "custom_email_domain", isNewInEnterprise: true },
      { key: "leadManagement", label: "Lead / enquiry management", description: "Capture walk-in and online enquiries", featureCode: "lead_management", isNewInGrowth: true },
      { key: "leadFollowupReminders", label: "Follow-up reminders", description: "Call/visit reminders, lead pipeline", featureCode: "lead_followup_reminders", isNewInGrowth: true },
      { key: "reEngagementAutomation", label: "Re-engagement automation", description: "Auto-message inactive members", featureCode: "re_engagement_automation", isNewInGrowth: true },
      { key: "advancedCrmLeadPipeline", label: "Advanced CRM & lead pipeline", description: "Full sales funnel, lead scoring, conversion forecasting", featureCode: "advanced_crm_lead_pipeline", isNewInEnterprise: true },
      { key: "referralProgram", label: "Referral program", description: "Members earn rewards for referrals", featureCode: "referral_program", isNewInEnterprise: true },
      { key: "loyaltyPointsSystem", label: "Loyalty points system", description: "Points for check-ins, renewals, referrals, purchases", featureCode: "loyalty_points_system", isNewInEnterprise: true },
      { key: "networkWideCampaignManager", label: "Network-wide campaign manager", description: "Run campaigns across all gyms", featureCode: "network_wide_campaign_manager", isNewInEnterprise: true },
      { key: "memberNpsSurveys", label: "Member NPS surveys", description: "Auto-trigger satisfaction surveys, track NPS", featureCode: "member_nps_surveys", isNewInEnterprise: true },
    ],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    description: "Business intelligence, member analytics, and data insights",
    icon: "BarChart",
    features: [
      { key: "basicReports", label: "Revenue & attendance reports", description: "Daily, weekly, monthly breakdowns", featureCode: "basic_reports" },
      { key: "attendanceReports", label: "Attendance report", description: "Footfall chart, peak hour analysis", featureCode: "attendance_reports" },
      { key: "expiryTracking", label: "Expiring members list", description: "Members expiring in 7/15/30 days", featureCode: "expiry_tracking" },
      { key: "goalTracking", label: "New member report", description: "Joinings per month, plan breakdown", featureCode: "goal_tracking" },
      { key: "aiRetentionAnalysis", label: "Churn & retention analytics", description: "Drop-off rates, renewal conversion, at-risk members", featureCode: "ai_retention_analysis", isNewInGrowth: true },
      { key: "trainerPerformanceReport", label: "Trainer performance report", description: "Sessions, PT bookings, ratings", featureCode: "trainer_performance_report", isNewInGrowth: true },
      { key: "classOccupancyReport", label: "Class occupancy report", description: "Fill rate, under-performing slots", featureCode: "class_occupancy_report", isNewInGrowth: true },
      { key: "leadConversionReport", label: "Lead conversion report", description: "Enquiries to paid conversions funnel", featureCode: "lead_conversion_report", isNewInGrowth: true },
      { key: "branchRevenueComparison", label: "Gym revenue comparison", description: "Collections and footfall across gyms", featureCode: "branch_revenue_comparison", isNewInGrowth: true },
      { key: "customDashboardsKpis", label: "Custom dashboards & KPIs", description: "Build, save, share personalized KPI views", featureCode: "custom_dashboards_kpis", isNewInEnterprise: true },
      { key: "scheduledReportDelivery", label: "Scheduled report delivery", description: "Auto-email weekly/monthly reports", featureCode: "scheduled_report_delivery", isNewInEnterprise: true },
      { key: "equipmentInventoryMaintenance", label: "Equipment inventory & maintenance", description: "Track equipment, service schedules, AMC", featureCode: "equipment_inventory_maintenance", isNewInEnterprise: true },
      { key: "dataExportCsvDownload", label: "Data export & CSV download", description: "Export reports and member datasets as CSV", featureCode: "data_export_csv_download", isNewInEnterprise: true },
    ],
  },
  {
    id: "portal",
    name: "Member-Facing Experience",
    description: "Member portal, mobile app, and digital experience",
    icon: "Smartphone",
    features: [
      { key: "memberPortal", label: "Member web portal", description: "Profile, membership, class schedule, payments", featureCode: "member_portal" },
      { key: "memberPortal", label: "Self-service class booking", description: "Book and cancel classes from portal", featureCode: "member_portal" },
      { key: "customBranding", label: "Branded member portal", description: "Logo, colors, custom domain", featureCode: "custom_branding", isNewInGrowth: true },
      { key: "dietWorkoutPlans", label: "Diet & workout plan viewer", description: "Trainer-assigned plans visible in portal and app", featureCode: "diet_workout_plans", isNewInGrowth: true },
      { key: "memberProgressTracking", label: "Member progress tracking", description: "Weight, measurements, milestones", featureCode: "member_progress_tracking", isNewInGrowth: true },
      { key: "inAppPushNotifications", label: "In-app push notifications", description: "Class reminders, offers, renewal prompts, system alerts", featureCode: "in_app_push_notifications", isNewInEnterprise: true },
      { key: "digitalMembershipCard", label: "Digital membership card", description: "Digital card in app showing status, plan, expiry", featureCode: "digital_membership_card", isNewInEnterprise: true },
      { key: "loyaltyRewardsInApp", label: "Loyalty & rewards in-app", description: "View points, redeem rewards, referral status", featureCode: "loyalty_rewards_in_app", isNewInEnterprise: true },
    ],
  },
  {
    id: "integrations",
    name: "Integrations & Infrastructure",
    description: "Third-party integrations, API, SSO, and infrastructure",
    icon: "Zap",
    features: [
      { key: "razorpayIntegration", label: "Razorpay integration", description: "Full gateway, auto-billing, refunds, webhooks", featureCode: "razorpay_integration", isNewInGrowth: true },
      { key: "whatsappBusinessApi", label: "WhatsApp Business API", description: "Official WABA integration", featureCode: "whatsapp_business_api", isNewInGrowth: true },
      { key: "googleCalendarSync", label: "Google Calendar sync", description: "Class schedule syncs to Google Calendar", featureCode: "google_calendar_sync", isNewInGrowth: true },
      { key: "restApiAccess", label: "REST API access", description: "Full API for custom integrations", featureCode: "rest_api_access", isNewInEnterprise: true },
      { key: "tallyZohoBooksIntegration", label: "Tally / Zoho Books integration", description: "Sync revenue, GST, expenses with accounting", featureCode: "tally_zoho_books_integration", isNewInEnterprise: true },
      { key: "webhookSupport", label: "Webhook support", description: "Push events: new member, payment, check-in, renewal", featureCode: "webhooks", isNewInEnterprise: true },
      { key: "auditLogs", label: "Audit logs", description: "Full activity log for compliance and security monitoring", featureCode: "audit_logs", isNewInEnterprise: true },
    ],
  },
  {
    id: "sla",
    name: "Support & SLA",
    description: "Enterprise-grade support, SLA, and account management",
    icon: "Shield",
    features: [
      { key: "prioritySupport", label: "Priority support", description: "WhatsApp, email, and phone priority support", featureCode: "priority_support", isNewInEnterprise: true },
    ],
  },
];

const UPGRADE_LABEL_MAP: Record<string, string> = {};

function buildLookups(): void {
  for (const cat of FEATURE_CATEGORIES) {
    for (const f of cat.features) {
      if (f.upgradeLabel) {
        UPGRADE_LABEL_MAP[f.featureCode] = f.upgradeLabel;
      }
    }
  }
}
buildLookups();

export function getUpgradeLabel(featureCode: string): string | undefined {
  return UPGRADE_LABEL_MAP[featureCode];
}

export function getLimitLabel(limitKey: string): string | undefined {
  for (const cat of FEATURE_CATEGORIES) {
    for (const f of cat.features) {
      if (f.limitKey === limitKey && f.limitLabel) {
        return f.limitLabel;
      }
    }
  }
  return undefined;
}

export function isNewInGrowth(featureCode: string): boolean {
  for (const cat of FEATURE_CATEGORIES) {
    for (const f of cat.features) {
      if (f.featureCode === featureCode && f.isNewInGrowth) {
        return true;
      }
    }
  }
  return false;
}

export function isNewInEnterprise(featureCode: string): boolean {
  for (const cat of FEATURE_CATEGORIES) {
    for (const f of cat.features) {
      if (f.featureCode === featureCode && f.isNewInEnterprise) {
        return true;
      }
    }
  }
  return false;
}
