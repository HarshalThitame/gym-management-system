import type { Database } from "./database";

export const leadStatuses = ["new", "contacted", "visit_scheduled", "trial_active", "converted", "not_interested", "lost"] as const;
export const leadSources = ["walk_in", "website", "phone", "referral", "social_media", "event", "advertisement", "other"] as const;

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export type LeadDashboard = {
  metrics: {
    totalLeads: number;
    newLeads: number;
    contactedLeads: number;
    trialActive: number;
    convertedLeads: number;
    lostLeads: number;
    todayLeads: number;
  };
  recentLeads: LeadRow[];
  followUps: LeadRow[];
};
