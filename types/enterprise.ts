import type { Database, Json } from "./database";

export const organizationTypes = ["single_gym", "multi_branch", "franchise"] as const;
export const organizationStatuses = ["active", "trial", "suspended", "deactivated", "archived"] as const;
export const gymStatuses = ["active", "suspended", "archived"] as const;
export const branchStatuses = ["planned", "active", "maintenance", "suspended", "deactivated", "archived"] as const;
export const branchRoles = ["owner", "admin", "manager", "staff", "trainer", "viewer"] as const;
export const branchAccessScopes = ["single_branch", "multi_branch", "organization"] as const;
export const planTiers = ["starter", "professional", "enterprise"] as const;
export const featureFlagStatuses = ["active", "paused", "archived"] as const;
export const subscriptionStatuses = ["trial", "active", "past_due", "cancelled", "suspended"] as const;
export const complianceRequestTypes = ["data_export", "data_deletion", "consent_review", "privacy_update"] as const;
export const complianceStatuses = ["open", "in_review", "approved", "completed", "rejected"] as const;
export const retentionCategories = ["attendance", "payments", "communications", "audit_logs", "fitness", "documents"] as const;
export const retentionActions = ["archive", "anonymize", "delete", "legal_hold"] as const;
export const backupTypes = ["database", "files", "configuration", "full"] as const;
export const backupScopes = ["platform", "tenant", "branch"] as const;
export const backupStatuses = ["queued", "running", "completed", "failed", "cancelled"] as const;
export const healthComponents = ["api", "database", "storage", "queue", "email", "payments", "auth", "background_jobs"] as const;
export const healthStatuses = ["healthy", "degraded", "down", "unknown"] as const;
export const securitySeverities = ["low", "medium", "high", "critical"] as const;
export const securityStatuses = ["open", "investigating", "resolved", "dismissed"] as const;
export const documentationAudiences = ["admin", "trainer", "member", "api", "deployment"] as const;
export const tenantDomainTypes = ["custom_domain", "subdomain", "system"] as const;
export const tenantDomainRoutingModes = ["organization", "branch", "gym"] as const;
export const tenantDomainStatuses = ["pending", "verified", "failed", "disabled"] as const;
export const tenantDomainSslStatuses = ["pending", "issued", "failed", "managed_by_vercel", "not_applicable"] as const;
export const tenantDomainProviderOperations = ["add", "sync", "verify", "remove"] as const;
export const tenantDomainProviderStatuses = ["pending", "succeeded", "failed", "skipped"] as const;

export type OrganizationType = (typeof organizationTypes)[number];
export type OrganizationStatus = (typeof organizationStatuses)[number];
export type GymStatus = (typeof gymStatuses)[number];
export type BranchStatus = (typeof branchStatuses)[number];
export type BranchRole = (typeof branchRoles)[number];
export type PlanTier = (typeof planTiers)[number];
export type FeatureFlagStatus = (typeof featureFlagStatuses)[number];
export type ComplianceRequestType = (typeof complianceRequestTypes)[number];
export type RetentionCategory = (typeof retentionCategories)[number];
export type BackupType = (typeof backupTypes)[number];
export type HealthStatus = (typeof healthStatuses)[number];
export type TenantDomainType = (typeof tenantDomainTypes)[number];
export type TenantDomainRoutingMode = (typeof tenantDomainRoutingModes)[number];
export type TenantDomainStatus = (typeof tenantDomainStatuses)[number];
export type TenantDomainSslStatus = (typeof tenantDomainSslStatuses)[number];
export type TenantDomainProviderOperation = (typeof tenantDomainProviderOperations)[number];
export type TenantDomainProviderStatus = (typeof tenantDomainProviderStatuses)[number];

export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
export type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
export type BranchSettingRow = Database["public"]["Tables"]["branch_settings"]["Row"];
export type BranchUserRow = Database["public"]["Tables"]["branch_users"]["Row"];
export type BranchMetricRow = Database["public"]["Tables"]["branch_metrics"]["Row"];
export type TenantConfigRow = Database["public"]["Tables"]["tenant_configs"]["Row"];
export type TenantDomainRow = Database["public"]["Tables"]["tenant_domains"]["Row"];
export type TenantDomainCheckRow = Database["public"]["Tables"]["tenant_domain_checks"]["Row"];
export type TenantDomainProviderEventRow = Database["public"]["Tables"]["tenant_domain_provider_events"]["Row"];
export type TenantDomainLatestCheckRow = Database["public"]["Views"]["tenant_domain_latest_checks"]["Row"];
export type TenantDomainLatestProviderEventRow = Database["public"]["Views"]["tenant_domain_latest_provider_events"]["Row"];
export type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
export type PlatformSubscriptionRow = Database["public"]["Tables"]["platform_subscriptions"]["Row"];
export type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
export type SecurityEventRow = Database["public"]["Tables"]["security_events"]["Row"];
export type ComplianceRequestRow = Database["public"]["Tables"]["compliance_requests"]["Row"];
export type RetentionPolicyRow = Database["public"]["Tables"]["retention_policies"]["Row"];
export type BackupJobRow = Database["public"]["Tables"]["backup_jobs"]["Row"];
export type SystemHealthCheckRow = Database["public"]["Tables"]["system_health_checks"]["Row"];
export type DocumentationArticleRow = Database["public"]["Tables"]["documentation_articles"]["Row"];
export type EnterpriseBranchMetricsLatestRow = Database["public"]["Views"]["enterprise_branch_metrics_latest"]["Row"];
export type EnterpriseTenantUsageSummaryRow = Database["public"]["Views"]["enterprise_tenant_usage_summary"]["Row"];
export type EnterpriseSecuritySummaryRow = Database["public"]["Views"]["enterprise_security_summary"]["Row"];
export type TenantResolutionRow = Database["public"]["Functions"]["resolve_tenant_by_host"]["Returns"][number];

export type EnterpriseKpi = {
  key: string;
  label: string;
  value: string;
  detail: string;
  status: "good" | "watch" | "risk";
};

export type BranchPerformancePoint = {
  branchName: string;
  revenue: number;
  members: number;
  attendance: number;
  trainerUtilization: number;
  classUtilization: number;
};

export type TenantUsagePoint = {
  organizationName: string;
  branches: number;
  activeMembers: number;
  storagePercent: number;
  branchPercent: number;
  memberPercent: number;
};

export type EnterpriseDashboard = {
  kpis: EnterpriseKpi[];
  organizations: OrganizationRow[];
  gyms: GymRow[];
  branches: BranchRow[];
  branchSettings: BranchSettingRow[];
  branchUsers: BranchUserRow[];
  branchMetrics: BranchMetricRow[];
  tenantConfigs: TenantConfigRow[];
  tenantDomains: TenantDomainRow[];
  tenantDomainChecks: TenantDomainLatestCheckRow[];
  tenantDomainProviderEvents: TenantDomainLatestProviderEventRow[];
  featureFlags: FeatureFlagRow[];
  subscriptions: PlatformSubscriptionRow[];
  activityEvents: ActivityEventRow[];
  securityEvents: SecurityEventRow[];
  complianceRequests: ComplianceRequestRow[];
  retentionPolicies: RetentionPolicyRow[];
  backupJobs: BackupJobRow[];
  healthChecks: SystemHealthCheckRow[];
  documentationArticles: DocumentationArticleRow[];
  branchLatestMetrics: EnterpriseBranchMetricsLatestRow[];
  tenantUsage: EnterpriseTenantUsageSummaryRow[];
  securitySummary: EnterpriseSecuritySummaryRow[];
  branchPerformance: BranchPerformancePoint[];
  tenantUsagePoints: TenantUsagePoint[];
};

export const ticketStatuses = ["open", "in_review", "in_progress", "waiting_on_customer", "waiting_on_third_party", "resolved", "closed", "reopened"] as const;
export const ticketPriorities = ["low", "medium", "high", "critical", "emergency"] as const;
export const ticketSources = ["manual", "email", "chat", "whatsapp", "mobile_app", "api", "automation", "phone"] as const;
export const ticketCustomerTypes = ["member", "trainer", "staff", "owner", "lead", "other"] as const;
export const ticketChannels = ["email", "sms", "whatsapp", "in_app", "push", "web_chat", "phone"] as const;
export const slaPolicyPriorities = ["low", "medium", "high", "critical", "emergency"] as const;
export const slaEventTypes = ["first_response_sla", "resolution_sla", "escalation_sla", "reopen_sla", "breached", "warning", "at_risk"] as const;
export const slaEventStatuses = ["active", "warning", "breached", "met", "cancelled"] as const;
export const escalationTriggerTypes = ["sla_breach", "negative_sentiment", "ticket_age", "priority", "reopened_count", "manual"] as const;
export const escalationTriggerSources = ["automatic", "agent", "manager", "system"] as const;
export const assignmentTypes = ["manual", "auto_skill", "auto_branch", "auto_tenant", "auto_round_robin", "auto_workload", "ai_recommended", "escalation"] as const;
export const automationTriggerEvents = ["ticket_created", "ticket_updated", "ticket_assigned", "ticket_status_changed", "ticket_priority_changed", "customer_replied", "sla_warning", "sla_breach", "ticket_inactive", "escalation_triggered", "feedback_received"] as const;
export const kbArticleTypes = ["internal", "customer"] as const;
export const kbStatuses = ["draft", "published", "archived"] as const;
export const feedbackSurveyTypes = ["csat", "nps", "ces"] as const;
export const timelineEventTypes = ["created", "status_changed", "priority_changed", "assigned", "reassigned", "escalated", "de_escalated", "note_added", "message_sent", "message_received", "attachment_added", "sla_warning", "sla_breached", "sla_met", "resolved", "reopened", "closed", "feedback_submitted", "automation_executed", "category_changed", "customer_viewed", "agent_viewed"] as const;
export const messageDirections = ["inbound", "outbound"] as const;
export const ticketNoteTypes = ["internal", "public"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketPriority = (typeof ticketPriorities)[number];
export type TicketSource = (typeof ticketSources)[number];
export type TicketCustomerType = (typeof ticketCustomerTypes)[number];
export type TicketChannel = (typeof ticketChannels)[number];
export type SlaEventType = (typeof slaEventTypes)[number];
export type SlaEventStatus = (typeof slaEventStatuses)[number];
export type EscalationTriggerType = (typeof escalationTriggerTypes)[number];
export type EscalationSource = (typeof escalationTriggerSources)[number];
export type AssignmentType = (typeof assignmentTypes)[number];
export type AutomationTriggerEvent = (typeof automationTriggerEvents)[number];
export type KbArticleType = (typeof kbArticleTypes)[number];
export type KbStatus = (typeof kbStatuses)[number];
export type FeedbackSurveyType = (typeof feedbackSurveyTypes)[number];
export type TimelineEventType = (typeof timelineEventTypes)[number];
export type MessageDirection = (typeof messageDirections)[number];

export type SupportTicketRow = {
  id: string; ticket_number: string; organization_id: string; gym_id: string | null; branch_id: string | null;
  category_id: string | null; customer_id: string | null; customer_name: string; customer_email: string | null;
  customer_phone: string | null; customer_type: string; membership_id: string | null; subject: string;
  description: string; status: string; priority: string; source: string; assigned_to: string | null;
  assigned_team: string | null; escalation_level: number; is_escalated: boolean; reopened_count: number;
  sla_policy_id: string | null; sla_first_response_at: string | null; sla_resolved_at: string | null;
  sla_breached: boolean; first_response_at: string | null; resolved_at: string | null; closed_at: string | null;
  reopened_at: string | null; metadata: Json; created_by: string | null; created_at: string; updated_at: string;
};
export type SupportTicketCategoryRow = { id: string; organization_id: string | null; name: string; slug: string; description: string | null; icon: string | null; color: string | null; is_system: boolean; is_active: boolean; sort_order: number; created_at: string; updated_at: string; };
export type SupportTicketAssignmentRow = { id: string; ticket_id: string; assigned_from: string | null; assigned_to: string | null; assignment_type: string; reason: string | null; created_by: string | null; created_at: string; };
export type SupportSlaPolicyRow = { id: string; organization_id: string | null; name: string; description: string | null; priority: string; first_response_minutes: number; resolution_minutes: number; escalation_minutes: number | null; reopen_minutes: number | null; is_default: boolean; is_active: boolean; created_by: string | null; created_at: string; updated_at: string; };
export type SupportSlaEventRow = { id: string; ticket_id: string; sla_policy_id: string | null; event_type: string; status: string; target_at: string; breached_at: string | null; met_at: string | null; metadata: Json; created_at: string; };
export type SupportEscalationRuleRow = { id: string; organization_id: string | null; name: string; trigger_on: string; priority_from: string | null; priority_to: string | null; escalate_after_minutes: number | null; escalate_from_level: number; escalate_to_level: number; notify_roles: string[]; is_active: boolean; created_at: string; updated_at: string; };
export type SupportTicketEscalationRow = { id: string; ticket_id: string; escalation_rule_id: string | null; escalated_from_level: number; escalated_to_level: number; escalated_to: string | null; reason: string; triggered_by: string; resolved_at: string | null; metadata: Json; created_by: string | null; created_at: string; };
export type SupportTicketNoteRow = { id: string; ticket_id: string; body: string; is_internal: boolean; mentions: string[]; attachment_ids: string[]; created_by: string | null; created_at: string; updated_at: string; author?: { id: string; full_name: string } | null; };
export type SupportTicketMessageRow = { id: string; ticket_id: string; channel: string; direction: string; sender_id: string | null; sender_name: string; sender_email: string | null; recipient_email: string | null; subject: string | null; body: string; body_html: string | null; external_id: string | null; attachments: Json; metadata: Json; created_at: string; };
export type SupportTicketAttachmentRow = { id: string; ticket_id: string; note_id: string | null; message_id: string | null; file_name: string; file_size: number; mime_type: string; storage_path: string; public_url: string | null; uploaded_by: string | null; created_at: string; };
export type SupportKnowledgeBaseArticleRow = { id: string; organization_id: string | null; category_id: string | null; title: string; slug: string; body: string; body_html: string | null; excerpt: string | null; article_type: string; audience: string[]; tags: string[]; status: string; view_count: number; helpful_count: number; not_helpful_count: number; author_id: string | null; published_at: string | null; created_at: string; updated_at: string; };
export type SupportAutomationRuleRow = { id: string; organization_id: string | null; name: string; description: string | null; trigger_event: string; conditions: Json; actions: Json; priority: number; is_active: boolean; execution_count: number; last_executed_at: string | null; created_by: string | null; created_at: string; updated_at: string; };
export type SupportCustomerFeedbackRow = { id: string; ticket_id: string; survey_type: string; score: number; nps_category: string | null; feedback_text: string | null; improvement_suggestions: string | null; created_at: string; };
export type SupportCustomerHealthScoreRow = { id: string; customer_id: string; organization_id: string; churn_probability: number; satisfaction_score: number; complaint_frequency: number; revenue_impact_score: number; health_score: number; last_ticket_resolved_at: string | null; open_ticket_count: number; lifetime_value: number; computed_at: string; created_at: string; updated_at: string; };
export type SupportTicketTimelineRow = { id: string; ticket_id: string; event_type: string; previous_value: string | null; new_value: string | null; actor_id: string | null; actor_name: string | null; actor_role: string | null; metadata: Json; ip_address: unknown; user_agent: string | null; created_at: string; };

export type SupportDashboard = {
  openTickets: number;
  closedTickets: number;
  avgResolutionMinutes: number;
  slaCompliancePercent: number;
  csatScore: number;
  npsScore: number;
  breachedCount: number;
  atRiskCount: number;
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByStatus: { status: string; count: number }[];
  agentPerformance: { agentId: string; agentName: string; resolved: number; avgResponseMins: number; csat: number }[];
};

export type CustomerHealthView = {
  profile: SupportTicketRow["customer_id"];
  membershipTier: string;
  lifetimeValue: number;
  churnProbability: number;
  satisfactionScore: number;
  healthScore: number;
  openTickets: number;
  lastVisit: string | null;
  attendanceRate: number;
  complaintFrequency: number;
};

export type TicketWithRelations = SupportTicketRow & {
  category?: SupportTicketCategoryRow | null;
  assignedAgent?: { id: string; name: string } | null;
  customer?: { id: string; name: string; email: string | null } | null;
  slaPolicy?: SupportSlaPolicyRow | null;
  messages?: SupportTicketMessageRow[];
  notes?: SupportTicketNoteRow[];
  timeline?: SupportTicketTimelineRow[];
  attachments?: SupportTicketAttachmentRow[];
  feedback?: SupportCustomerFeedbackRow | null;
};

export const securityEventCategories = ["authentication", "authorization", "data_breach", "malware", "phishing", "insider_threat", "misconfiguration", "third_party", "physical_security", "compliance_violation", "other"] as const;
export const riskLevels = ["low", "medium", "high"] as const;
export const riskEventTypes = ["login", "login_attempt", "mfa_verification", "password_change", "device_change", "location_change", "impossible_travel", "vpn_detected", "tor_detected", "bot_detected", "new_device", "new_location", "unusual_time", "failed_attempt", "breached_password", "reused_password"] as const;
export const mfaMethodTypes = ["totp", "sms", "email", "push", "backup_code", "fido2", "webauthn"] as const;
export const mfaRequirements = ["optional", "required", "required_for_admins", "required_for_sensitive_actions"] as const;
export const emergencyUseCases = ["tenant_lockout", "critical_outage", "admin_recovery", "security_incident", "data_recovery", "other"] as const;
export const emergencyStatuses = ["pending", "approved", "denied", "active", "expired", "revoked"] as const;
export const emergencyAccessLevels = ["read_only", "write", "admin", "super_admin"] as const;
export const sensitiveActionTypes = ["delete_tenant", "delete_branch", "refund_approve", "permission_change", "export_member_data", "bulk_operation", "billing_change", "subscription_change", "role_override", "emergency_access", "data_purge", "setting_override"] as const;
export const verificationMethods = ["password", "mfa", "dual_authorization", "emergency_override"] as const;
export const deviceTypes = ["desktop", "mobile", "tablet", "unknown"] as const;
export const incidentActions = ["created", "assigned", "escalated", "note_added", "status_changed", "evidence_added", "contained", "resolved", "closed", "reopened"] as const;
export const complianceReportTypes = ["audit", "access_review", "security_posture", "incident", "gdpr", "soc2", "hipaa", "pci"] as const;
export const threatIntelIndicatorTypes = ["ip", "domain", "email", "hash", "user_agent"] as const;
export const notificationChannels = ["email", "sms", "push", "slack", "teams", "webhook"] as const;
export const passwordPolicyFields = ["min_length", "require_uppercase", "require_lowercase", "require_numbers", "require_special", "expiration_days", "history_count", "max_failed_attempts", "lockout_duration_minutes"] as const;

export type RiskLevel = (typeof riskLevels)[number];
export type RiskEventType = (typeof riskEventTypes)[number];
export type MfaMethodType = (typeof mfaMethodTypes)[number];
export type MfaRequirement = (typeof mfaRequirements)[number];
export type EmergencyUseCase = (typeof emergencyUseCases)[number];
export type EmergencyStatus = (typeof emergencyStatuses)[number];
export type SensitiveActionType = (typeof sensitiveActionTypes)[number];
export type VerificationMethod = (typeof verificationMethods)[number];
export type ComplianceReportType = (typeof complianceReportTypes)[number];

export type UserMfaMethodRow = { id: string; user_id: string; method_type: string; method_name: string; is_primary: boolean; is_active: boolean; enrolled_at: string; last_used_at: string | null; metadata: Json; created_at: string; };
export type MfaPolicyRow = { id: string; organization_id: string | null; name: string; requirement: string; allowed_methods: string[]; min_factors: number; enforce_for_roles: string[]; is_active: boolean; created_by: string | null; created_at: string; updated_at: string; };
export type PasswordPolicyRow = { id: string; organization_id: string | null; name: string; min_length: number; require_uppercase: boolean; require_lowercase: boolean; require_numbers: boolean; require_special: boolean; expiration_days: number | null; history_count: number; prevent_common: boolean; prevent_breached: boolean; max_failed_attempts: number; lockout_duration_minutes: number; is_active: boolean; created_at: string; updated_at: string; };
export type UserSessionRow = { id: string; user_id: string; session_token_hash: string; ip_address: unknown; user_agent: string | null; device_fingerprint: string | null; device_type: string | null; browser: string | null; os: string | null; location_city: string | null; location_country: string | null; location_lat: number | null; location_lng: number | null; is_trusted: boolean; risk_score: number; is_current: boolean; logged_in_at: string; last_active_at: string; expired_at: string | null; revoked_at: string | null; created_at: string; };
export type RiskEventRow = { id: string; user_id: string | null; organization_id: string | null; event_type: string; risk_score: number; risk_level: string; signals: Json; signals_detail: Json; ip_address: unknown; device_fingerprint: string | null; user_agent: string | null; location: Json; action_taken: string | null; resolved: boolean; resolved_at: string | null; created_at: string; };
export type TrustedDeviceRow = { id: string; user_id: string; device_fingerprint: string; device_name: string | null; device_type: string | null; browser: string | null; os: string | null; ip_address: unknown; first_seen_at: string; last_seen_at: string; expires_at: string | null; is_approved: boolean; risk_score: number; created_at: string; };
export type EmergencyOverrideRow = { id: string; organization_id: string | null; requested_by: string; approved_by: string | null; reason: string; justification: string; use_case: string; access_level: string; status: string; mfa_verified: boolean; duration_minutes: number; started_at: string | null; expired_at: string | null; actions_performed: Json; metadata: Json; created_at: string; updated_at: string; };
export type SensitiveActionLogRow = { id: string; actor_id: string; organization_id: string | null; action_type: string; resource_type: string; resource_id: string | null; description: string; verification_method: string; mfa_verified: boolean; ip_address: unknown; user_agent: string | null; metadata: Json; created_at: string; };
export type IncidentInvestigationRow = { id: string; event_id: string; action: string; actor_id: string | null; note: string | null; metadata: Json; created_at: string; };
export type ComplianceReportRow = { id: string; organization_id: string | null; report_type: string; title: string; status: string; period_start: string; period_end: string; data: Json; file_url: string | null; generated_by: string | null; generated_at: string | null; expires_at: string | null; created_at: string; };
export type ThreatIntelCacheRow = { id: string; indicator_type: string; indicator_value: string; threat_score: number; category: string | null; source: string; is_malicious: boolean; tags: string[]; last_checked_at: string; expires_at: string | null; created_at: string; };
export type SecurityNotificationRuleRow = { id: string; organization_id: string | null; name: string; event_types: string[]; severity_threshold: string; channels: string[]; webhook_url: string | null; slack_webhook: string | null; teams_webhook: string | null; is_active: boolean; created_at: string; updated_at: string; };

export type EnterpriseSecurityDashboard = {
  totalEvents: number;
  criticalIncidents: number;
  activeIncidents: number;
  logins24h: number;
  failedLogins24h: number;
  activeSessions: number;
  mfaEnrollments: number;
  highRiskSessions: number;
  activeOverrides: number;
  sensitiveActions24h: number;
};

export type SecurityDashboardKpi = {
  label: string;
  value: number;
  status: "good" | "watch" | "risk";
  trend: "up" | "down" | "neutral";
  detail: string;
};

export type RiskAssessmentResult = {
  riskScore: number;
  riskLevel: RiskLevel;
  signals: Array<{ name: string; score: number; detail: string }>;
  action: "allowed" | "mfa_required" | "blocked" | "review_required";
};

export type JsonRecord = Record<string, Json>;
