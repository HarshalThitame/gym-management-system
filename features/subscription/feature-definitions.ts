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
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: "members",
    name: "Members & Access",
    description: "Member management, check-in, and access control features",
    icon: "Users",
    features: [
      { key: "memberManagement", label: "Member profiles", description: "Full name, photo, DOB, contact, emergency contact, health notes, custom fields", featureCode: "member_management", limitKey: "max_members", limitLabel: "Up to 200 active members on Starter" },
      { key: "qrAttendanceEnabled", label: "QR code check-in", description: "Members can scan QR from their profile or printed card at entry gate", featureCode: "qr_attendance" },
      { key: "manualAttendance", label: "Manual check-in", description: "Staff can mark attendance manually from admin dashboard", featureCode: "manual_attendance" },
      { key: "expiryTracking", label: "Member status tracking", description: "Active, Expired, Paused, Frozen — maintain status change history", featureCode: "expiry_tracking" },
      { key: "membershipPauseFreeze", label: "Membership pause / freeze", description: "Pause memberships for travel or injury. Auto-resume on selected date", featureCode: "membership_pause_freeze" },
      { key: "biometricAttendanceEnabled", label: "Biometric check-in", description: "Fingerprint scanner integration at entry gate", featureCode: "biometric_attendance", isNewInGrowth: true },
      { key: "multiBranchManagement", label: "Multi-branch access", description: "Members can check in at any organization branch", featureCode: "multi_branch_management", isNewInGrowth: true },
      { key: "memberTaggingSegments", label: "Member tagging & segments", description: "Tags like weight-loss, senior, corporate, premium, trial for targeted communication", featureCode: "member_tagging_segments", isNewInGrowth: true },
      { key: "faceRecognitionAttendance", label: "Facial recognition check-in", description: "AI-powered face recognition at entry", featureCode: "face_recognition_attendance", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "billing",
    name: "Membership Plans & Billing",
    description: "Plan creation, payments, invoicing, and billing automation",
    icon: "CreditCard",
    features: [
      { key: "memberManagement", label: "Membership plan builder", description: "Create unlimited monthly, quarterly, annual, day-pass, and custom plans", featureCode: "member_management", limitKey: "membership_plan_types", limitLabel: "Unlimited on Growth" },
      { key: "paymentTracking", label: "Cash, UPI & online payments", description: "All payment modes with auto-reconciliation dashboard", featureCode: "payment_tracking" },
      { key: "onlinePaymentLinks", label: "Online payment link", description: "Generate Razorpay/PayU one-time links, share via WhatsApp", featureCode: "online_payment_links" },
      { key: "renewalReminders", label: "Renewal reminders", description: "Auto reminder before expiry via SMS/WhatsApp", featureCode: "renewal_reminders" },
      { key: "billingInvoices", label: "GST invoices & PDF receipts", description: "Full GST-compliant invoice, auto-generated, delivered via email and WhatsApp", featureCode: "billing_invoices" },
      { key: "autoBilling", label: "Auto-billing & recurring charges", description: "NACH mandate or card-on-file auto-debit on renewal date", featureCode: "auto_billing", isNewInGrowth: true },
      { key: "discountPromoCodes", label: "Discount & promo codes", description: "Fixed or percentage discount with expiry date and usage limits", featureCode: "discount_promo_codes", isNewInGrowth: true },
      { key: "paymentFailureHandling", label: "Payment failure handling", description: "Auto-retry failed auto-debits, notify member and staff on failure", featureCode: "payment_failure_handling", isNewInGrowth: true },
      { key: "partialPaymentDues", label: "Partial payment & dues tracking", description: "Record partial payment, track outstanding balance per member", featureCode: "partial_payment_dues", isNewInGrowth: true },
      { key: "razorpayPayuIntegration", label: "Razorpay/PayU integration", description: "Full payment gateway with auto-billing, refunds, webhook sync", featureCode: "razorpay_payu_integration", isNewInGrowth: true },
      { key: "corporateBulkMemberships", label: "Corporate / bulk memberships", description: "Company tie-ups for employee memberships", featureCode: "corporate_bulk_memberships", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "classes",
    name: "Class Scheduling",
    description: "Timetable management, capacity control, and member booking",
    icon: "Calendar",
    features: [
      { key: "classBooking", label: "Unlimited class slots", description: "No weekly cap on recurring class slots like Zumba, Yoga, Spinning", featureCode: "class_booking", limitKey: "weekly_classes", limitLabel: "Unlimited on Growth" },
      { key: "classBooking", label: "Class capacity control", description: "Set maximum seats per class, auto-close booking when full", featureCode: "class_booking" },
      { key: "memberPortal", label: "Member self-booking from web portal", description: "Members can browse and book available classes", featureCode: "member_portal" },
      { key: "classBooking", label: "Class cancellation by admin", description: "Admin can cancel class, notify enrolled members via SMS", featureCode: "class_booking" },
      { key: "waitlistManagement", label: "Waitlist management", description: "Auto-promote next member from waitlist after cancellation", featureCode: "waitlist_management", isNewInGrowth: true },
      { key: "ptSessions", label: "PT session booking", description: "Members book 1-on-1 sessions with specific trainers, trainer gets notified", featureCode: "pt_sessions", isNewInGrowth: true },
      { key: "classAttendanceTracking", label: "Class attendance tracking", description: "Mark attended vs no-show, view per-class attendance history", featureCode: "class_attendance_tracking", isNewInGrowth: true },
      { key: "classBooking", label: "Recurring & one-time classes", description: "Weekly recurring slots and special one-off workshops", featureCode: "class_booking", isNewInGrowth: true },
      { key: "crossBranchClassBooking", label: "Cross-branch class booking", description: "Members book classes at any branch location", featureCode: "cross_branch_class_booking", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "staff",
    name: "Staff & Trainer Management",
    description: "Staff accounts, roles, trainer profiles, and HR tools",
    icon: "Briefcase",
    features: [
      { key: "staffManagement", label: "Staff accounts", description: "Create logins for front desk, trainers, branch managers", featureCode: "staff_management", limitKey: "max_staff", limitLabel: "Up to 15 staff users" },
      { key: "roleBasedPermissions", label: "Role-based permissions", description: "Admin, Manager, Trainer, Receptionist roles with scoped dashboard access", featureCode: "role_based_permissions", isNewInGrowth: true },
      { key: "trainerManagement", label: "Trainer profile", description: "Bio, certifications, photo — visible to members on portal", featureCode: "trainer_management" },
      { key: "trainerCommissionsPayroll", label: "Trainer commission tracking", description: "Auto-calculate earnings per PT session or class, monthly payout summary", featureCode: "trainer_commissions_payroll", isNewInGrowth: true },
      { key: "payrollExport", label: "Payroll export", description: "Export monthly salary and commission report as CSV/PDF", featureCode: "payroll_export", isNewInGrowth: true },
      { key: "staffAttendanceLeave", label: "Staff attendance & leave", description: "Clock-in/out, leave requests, monthly attendance report", featureCode: "staff_attendance_leave", upgradeLabel: "Enterprise only" },
      { key: "advancedRbac", label: "Custom permissions", description: "Fine-grained access control per staff member", featureCode: "advanced_rbac", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "communication",
    name: "Communication & CRM",
    description: "Member notifications, CRM, broadcasts, and marketing automation",
    icon: "MessageSquare",
    features: [
      { key: "whatsappIntegration", label: "WhatsApp & SMS notifications", description: "All system-triggered messages for membership, payments, classes", featureCode: "whatsapp_integration" },
      { key: "smsIntegration", label: "SMS alerts", description: "OTP login, renewal reminders, check-in confirmation", featureCode: "sms_integration", limitKey: "sms_monthly", limitLabel: "Up to 5,000 SMS per month" },
      { key: "birthdayGreetings", label: "Birthday greetings", description: "Auto WhatsApp message on member birthday", featureCode: "birthday_greetings" },
      { key: "broadcastMessages", label: "WhatsApp broadcast", description: "Send bulk messages to all members or tagged segments", featureCode: "broadcast_messages", isNewInGrowth: true },
      { key: "emailCampaigns", label: "Email campaigns", description: "Designed email templates for offers, renewals, events", featureCode: "email_campaigns", isNewInGrowth: true },
      { key: "leadManagement", label: "Lead / enquiry management", description: "Capture walk-in and online enquiries, assign follow-up tasks", featureCode: "lead_management", isNewInGrowth: true },
      { key: "leadFollowupReminders", label: "Follow-up reminders for leads", description: "Call reminders, visit reminders, lead status: new → trial → converted", featureCode: "lead_followup_reminders", isNewInGrowth: true },
      { key: "reEngagementAutomation", label: "Re-engagement automation", description: "Auto-message inactive members after 14/30 days of no check-in", featureCode: "re_engagement_automation", isNewInGrowth: true },
      { key: "whatsappBusinessApi", label: "WhatsApp Business API", description: "Official WABA integration for broadcast and automation", featureCode: "whatsapp_business_api", isNewInGrowth: true },
    ],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    description: "Business intelligence, member analytics, and data insights",
    icon: "BarChart",
    features: [
      { key: "basicReports", label: "Revenue & attendance reports", description: "All Starter reports with daily, weekly, monthly breakdowns", featureCode: "basic_reports" },
      { key: "attendanceReports", label: "Attendance report", description: "Daily footfall chart, peak hour analysis", featureCode: "attendance_reports" },
      { key: "expiryTracking", label: "Expiring members list", description: "Members expiring in next 7 / 15 / 30 days", featureCode: "expiry_tracking" },
      { key: "goalTracking", label: "New member report", description: "Joinings per month, plan breakdown", featureCode: "goal_tracking" },
      { key: "aiRetentionAnalysis", label: "Churn & retention analytics", description: "Drop-off rates, renewal conversion percentage, at-risk member list", featureCode: "ai_retention_analysis", isNewInGrowth: true },
      { key: "trainerPerformanceReport", label: "Trainer performance report", description: "Sessions conducted, PT bookings, member ratings per trainer", featureCode: "trainer_performance_report", isNewInGrowth: true },
      { key: "classOccupancyReport", label: "Class occupancy report", description: "Fill rate per class type, identify under-performing slots", featureCode: "class_occupancy_report", isNewInGrowth: true },
      { key: "leadConversionReport", label: "Lead conversion report", description: "Enquiries → trials → paid conversions funnel", featureCode: "lead_conversion_report", isNewInGrowth: true },
      { key: "branchRevenueComparison", label: "Branch-wise revenue comparison", description: "Compare collections and footfall across branches", featureCode: "branch_revenue_comparison", isNewInGrowth: true },
      { key: "customDashboards", label: "Custom dashboards & KPIs", description: "Build and save custom KPI views", featureCode: "custom_dashboards", upgradeLabel: "Enterprise only" },
      { key: "franchiseRollupReports", label: "Franchise rollup reports", description: "Aggregated reports across all franchise locations", featureCode: "franchise_rollup_reports", upgradeLabel: "Enterprise only" },
      { key: "apiAccessEnabled", label: "Data export / API", description: "CSV export or REST API access", featureCode: "api_access", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "portal",
    name: "Member-Facing Experience",
    description: "Member portal, mobile app, and digital experience",
    icon: "Smartphone",
    features: [
      { key: "memberPortal", label: "Member web portal", description: "View profile, membership status, class schedule, payment history", featureCode: "member_portal" },
      { key: "memberPortal", label: "Self-service class booking", description: "Members can book and cancel classes from portal", featureCode: "member_portal" },
      { key: "customBranding", label: "Branded member portal", description: "Gym logo, colors, custom domain/subdomain", featureCode: "custom_branding", isNewInGrowth: true },
      { key: "dietWorkoutPlans", label: "Diet & workout plan viewer", description: "Trainer-assigned nutrition and workout plans visible to members", featureCode: "diet_workout_plans", isNewInGrowth: true },
      { key: "memberProgressTracking", label: "Member progress tracking", description: "Weight, body measurements, fitness milestones over time", featureCode: "member_progress_tracking", isNewInGrowth: true },
      { key: "whiteLabelMobileApp", label: "White-label mobile app", description: "iOS and Android app with organization branding", featureCode: "white_label_mobile_app", upgradeLabel: "Enterprise only" },
      { key: "brandedMobileApp", label: "Branded mobile app", description: "iOS and Android app with gym name and logo", featureCode: "branded_mobile_app", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "integrations",
    name: "Integrations",
    description: "Third-party integrations and API access",
    icon: "Zap",
    features: [
      { key: "razorpayPayuIntegration", label: "Razorpay / PayU integration", description: "Full payment gateway with auto-billing, refunds, webhook sync", featureCode: "razorpay_payu_integration", isNewInGrowth: true },
      { key: "whatsappBusinessApi", label: "WhatsApp Business API", description: "Official WABA integration for broadcast and automation", featureCode: "whatsapp_business_api", isNewInGrowth: true },
      { key: "googleCalendarSync", label: "Google Calendar sync", description: "Class schedule syncs to trainer Google Calendar", featureCode: "google_calendar_sync", isNewInGrowth: true },
      { key: "tallyZohoBooksIntegration", label: "Tally / Zoho Books integration", description: "Accounting software for automated bookkeeping", featureCode: "tally_zoho_books_integration", upgradeLabel: "Enterprise only" },
      { key: "restApiAccess", label: "REST API access", description: "Programmatic access to platform data and operations", featureCode: "rest_api_access", upgradeLabel: "Enterprise only" },
    ],
  },
];

const UPGRADE_LABEL_MAP: Record<string, string> = {};

function buildLookups() {
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
