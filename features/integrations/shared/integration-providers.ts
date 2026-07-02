export type IntegrationProvider = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  { id: "stripe", label: "Stripe", description: "Payment processing & subscriptions", icon: "credit-card" },
  { id: "slack", label: "Slack", description: "Team notifications & alerts", icon: "message-square" },
  { id: "zoom", label: "Zoom", description: "Virtual classes & meetings", icon: "video" },
  { id: "google-calendar", label: "Google Calendar", description: "Schedule sync & availability", icon: "calendar-days" },
  { id: "mailchimp", label: "Mailchimp", description: "Email marketing automation", icon: "mail" },
  { id: "twilio", label: "Twilio", description: "SMS notifications & alerts", icon: "message-circle" },
];
