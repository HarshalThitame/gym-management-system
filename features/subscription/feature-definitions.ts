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
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: "members",
    name: "Members & Access",
    description: "Member management, check-in, and access control features",
    icon: "Users",
    features: [
      { key: "memberManagement", label: "Member profiles", description: "Full name, photo, DOB, contact, emergency contact, health notes", featureCode: "member_management", limitKey: "max_members", limitLabel: "Up to 200 active members" },
      { key: "qrAttendanceEnabled", label: "QR code check-in", description: "Members can scan QR from their profile or printed card at entry gate", featureCode: "qr_attendance" },
      { key: "manualAttendance", label: "Manual check-in", description: "Staff can mark attendance manually from admin dashboard", featureCode: "manual_attendance" },
      { key: "expiryTracking", label: "Member status tracking", description: "Active, Expired, Paused, Frozen — maintain status change history", featureCode: "expiry_tracking" },
      { key: "membershipPauseFreeze", label: "Membership pause / freeze", description: "Pause memberships for travel or injury. Auto-resume on selected date", featureCode: "membership_pause_freeze" },
      { key: "biometricAttendanceEnabled", label: "Biometric / facial check-in", description: "Fingerprint or face recognition at entry", featureCode: "biometric_attendance", upgradeLabel: "Growth & above" },
      { key: "multiBranchManagement", label: "Multi-branch access", description: "Member can check in at multiple branch locations", featureCode: "multi_branch_management", upgradeLabel: "Growth & above" },
    ],
  },
  {
    id: "billing",
    name: "Membership Plans & Billing",
    description: "Plan creation, payments, invoicing, and billing automation",
    icon: "CreditCard",
    features: [
      { key: "memberManagement", label: "Membership plan builder", description: "Create monthly, quarterly, half-yearly, and yearly plans with custom pricing", featureCode: "member_management", limitKey: "membership_plan_types", limitLabel: "Up to 10 plan types" },
      { key: "paymentTracking", label: "Cash & UPI payment recording", description: "Log offline payments, mark as paid with date and collected-by staff", featureCode: "payment_tracking" },
      { key: "onlinePaymentLinks", label: "Online payment link", description: "Generate Razorpay/PayU one-time links, share via WhatsApp", featureCode: "online_payment_links" },
      { key: "renewalReminders", label: "Renewal reminders", description: "Auto reminder 7 days before expiry via SMS/WhatsApp", featureCode: "renewal_reminders" },
      { key: "billingInvoices", label: "GST invoice basic", description: "Auto-generated GST invoice on payment, downloadable PDF", featureCode: "billing_invoices" },
      { key: "autoBilling", label: "Auto-billing / recurring debit", description: "NACH or card-on-file auto-charge", featureCode: "auto_billing", upgradeLabel: "Growth & above" },
      { key: "discountPromoCodes", label: "Discount & promo codes", description: "Coupon codes for referrals or seasonal offers", featureCode: "discount_promo_codes", upgradeLabel: "Growth & above" },
      { key: "corporateBulkMemberships", label: "Corporate / bulk memberships", description: "Company tie-ups for employee memberships", featureCode: "corporate_bulk_memberships", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "classes",
    name: "Class Scheduling",
    description: "Timetable management, capacity control, and member booking",
    icon: "Calendar",
    features: [
      { key: "classBooking", label: "Weekly class timetable", description: "Recurring class slots like Zumba, Yoga, Spinning, etc.", featureCode: "class_booking", limitKey: "weekly_classes", limitLabel: "Up to 5 classes per week" },
      { key: "classBooking", label: "Class capacity control", description: "Set maximum seats per class, auto-close booking when full", featureCode: "class_booking" },
      { key: "memberPortal", label: "Member self-booking from web portal", description: "Members can browse and book available classes", featureCode: "member_portal" },
      { key: "classBooking", label: "Class cancellation by admin", description: "Admin can cancel class, notify enrolled members via SMS", featureCode: "class_booking" },
      { key: "waitlistManagement", label: "Waitlist management", description: "Auto-promote members from waitlist after cancellation", featureCode: "waitlist_management", upgradeLabel: "Growth & above" },
      { key: "ptSessions", label: "Personal training session booking", description: "Book 1-on-1 sessions with specific trainers", featureCode: "pt_sessions", upgradeLabel: "Growth & above" },
      { key: "crossBranchClassBooking", label: "Cross-branch class booking", description: "Members book classes at any branch location", featureCode: "cross_branch_class_booking", upgradeLabel: "Enterprise only" },
    ],
  },
  {
    id: "staff",
    name: "Staff & Trainer Management",
    description: "Staff accounts, roles, trainer profiles, and HR tools",
    icon: "Briefcase",
    features: [
      { key: "staffManagement", label: "Staff accounts", description: "Create login accounts for front desk and trainers", featureCode: "staff_management", limitKey: "max_staff", limitLabel: "Up to 3 staff users" },
      { key: "advancedRbac", label: "Basic role assignment", description: "Admin or Staff roles with limited dashboard access", featureCode: "advanced_rbac" },
      { key: "trainerManagement", label: "Trainer profile", description: "Bio, specialisation, photo — visible to members on portal", featureCode: "trainer_management" },
      { key: "trainerCommissionsPayroll", label: "Trainer commissions & payroll", description: "Track earnings per session, export payroll report", featureCode: "trainer_commissions_payroll", upgradeLabel: "Growth & above" },
      { key: "staffAttendanceLeave", label: "Staff attendance & leave", description: "Clock-in/out, leave requests, monthly attendance report", featureCode: "staff_attendance_leave", upgradeLabel: "Enterprise only" },
      { key: "advancedRbac", label: "Custom permissions", description: "Fine-grained access control per staff member", featureCode: "advanced_rbac", upgradeLabel: "Growth & above" },
    ],
  },
  {
    id: "communication",
    name: "Communication",
    description: "Member notifications, alerts, and marketing tools",
    icon: "MessageSquare",
    features: [
      { key: "whatsappIntegration", label: "WhatsApp notifications", description: "Membership expiry, payment receipt, class booking confirmation", featureCode: "whatsapp_integration" },
      { key: "smsIntegration", label: "SMS alerts", description: "OTP login, renewal reminders, check-in confirmation", featureCode: "sms_integration", limitKey: "sms_monthly", limitLabel: "Up to 500 SMS per month" },
      { key: "birthdayGreetings", label: "Birthday greetings", description: "Auto WhatsApp message on member birthday", featureCode: "birthday_greetings" },
      { key: "broadcastMessages", label: "Broadcast messages", description: "Send announcements to all or filtered members", featureCode: "broadcast_messages", upgradeLabel: "Growth & above" },
      { key: "emailCampaigns", label: "Email campaigns", description: "Drip emails for leads, re-engagement, and offers", featureCode: "email_campaigns", upgradeLabel: "Growth & above" },
      { key: "leadManagement", label: "Lead CRM", description: "Track enquiries, follow-up tasks, conversion pipeline", featureCode: "lead_management", upgradeLabel: "Growth & above" },
    ],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    description: "Business intelligence, member analytics, and data insights",
    icon: "BarChart",
    features: [
      { key: "basicReports", label: "Revenue summary", description: "Daily, weekly, monthly collection totals. Cash vs online split", featureCode: "basic_reports" },
      { key: "attendanceReports", label: "Attendance report", description: "Daily footfall chart, peak hour analysis", featureCode: "attendance_reports" },
      { key: "expiryTracking", label: "Expiring members list", description: "Members expiring in next 7 / 15 / 30 days", featureCode: "expiry_tracking" },
      { key: "goalTracking", label: "New member report", description: "Joinings per month, plan breakdown", featureCode: "goal_tracking" },
      { key: "aiRetentionAnalysis", label: "Churn & retention analytics", description: "Drop-off rates, renewal conversion, at-risk members", featureCode: "ai_retention_analysis", upgradeLabel: "Growth & above" },
      { key: "customDashboards", label: "Custom dashboards", description: "Build and save custom KPI views", featureCode: "custom_dashboards", upgradeLabel: "Enterprise only" },
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
      { key: "brandedMobileApp", label: "Branded mobile app", description: "iOS and Android app with gym name and logo", featureCode: "branded_mobile_app", upgradeLabel: "Growth add-on / Enterprise" },
      { key: "dietWorkoutPlans", label: "Diet & workout plans", description: "Trainer-assigned nutrition and workout plans visible to members", featureCode: "diet_workout_plans", upgradeLabel: "Growth add-on / Enterprise" },
    ],
  },
];

export function getUpgradeLabel(featureCode: string): string | undefined {
  for (const cat of FEATURE_CATEGORIES) {
    for (const f of cat.features) {
      if (f.featureCode === featureCode && f.upgradeLabel) {
        return f.upgradeLabel;
      }
    }
  }
  return undefined;
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
