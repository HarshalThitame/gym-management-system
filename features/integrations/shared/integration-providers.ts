import type { IntegrationProviderId } from "../services/integrations-service";

export type IntegrationProvider = {
  id: IntegrationProviderId;
  label: string;
  description: string;
  icon: string;
  category: "payments" | "calendar" | "whatsapp" | "sms" | "crm";
};

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: "razorpay",
    label: "Razorpay",
    description: "UPI, cards, subscriptions, refunds, and webhook-backed payment operations.",
    icon: "credit-card",
    category: "payments",
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    description: "Real schedule sync for classes and operational calendar visibility.",
    icon: "calendar-days",
    category: "calendar",
  },
  {
    id: "msg91_whatsapp",
    label: "MSG91 WhatsApp",
    description: "Template-based WhatsApp delivery for campaigns, reminders, and member updates.",
    icon: "message-square",
    category: "whatsapp",
  },
  {
    id: "msg91_sms",
    label: "MSG91 SMS",
    description: "India-first SMS delivery using approved MSG91 flow templates and DLT-aware routing.",
    icon: "message-circle",
    category: "sms",
  },
  {
    id: "hubspot",
    label: "HubSpot CRM",
    description: "Private-app based CRM sync for leads, pipeline status, and contact updates.",
    icon: "briefcase-business",
    category: "crm",
  },
  {
    id: "zoho_crm",
    label: "Zoho CRM",
    description: "OAuth-backed CRM sync for leads with refresh-token recovery and durable mapping.",
    icon: "briefcase-business",
    category: "crm",
  },
];
