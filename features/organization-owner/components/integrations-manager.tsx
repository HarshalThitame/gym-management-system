"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Activity,
  ExternalLink,
  BriefcaseBusiness,
  Database,
  Link2Off,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserRound,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import type { IntegrationDashboardData } from "../actions/integration-actions";
import type { CrmIntegrationDetail } from "../actions/integration-actions";
import type { IntegrationProviderId } from "@/features/integrations/services/integrations-service";
import {
  disconnectOrgGoogleCalendarIntegrationAction,
  disconnectOrgProviderIntegrationAction,
  getOrgGoogleCalendarAuthUrlAction,
  saveOrgCrmIntegrationAction,
  saveOrgGoogleCalendarConfigAction,
  saveOrgMsg91SmsIntegrationAction,
  saveOrgMsg91WhatsAppIntegrationAction,
  saveOrgRazorpayIntegrationAction,
  backfillOrgCrmLeadsAction,
  retryOrgCrmSyncJobAction,
  testOrgCrmIntegrationAction,
  testOrgGoogleCalendarIntegrationAction,
  testOrgMsg91SmsIntegrationAction,
  testOrgMsg91WhatsAppIntegrationAction,
  testOrgRazorpayIntegrationAction,
  disconnectOrgRazorpayIntegrationAction,
} from "../actions/integration-actions";

type Props = {
  dashboard: IntegrationDashboardData;
};

type ProviderFormState = {
  authKey?: string;
  flowId?: string;
  senderId?: string;
  testMobile?: string;
  integratedNumber?: string;
  namespace?: string;
  templateName?: string;
  languageCode?: string;
  calendarId?: string;
  syncClasses?: boolean;
  syncPtSessions?: boolean;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  testEmail?: string;
  label?: string;
  accessToken?: string;
  portalId?: string;
  syncLeads?: boolean;
  syncContacts?: boolean;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accountsDomain?: string;
  firstNameField?: string;
  lastNameField?: string;
  emailField?: string;
  phoneField?: string;
  notesField?: string;
  sourceField?: string;
  statusField?: string;
};

const ICON_MAP: Record<IntegrationProviderId, ReactNode> = {
  razorpay: <CreditCard className="size-5" />,
  google_calendar: <CalendarDays className="size-5" />,
  msg91_whatsapp: <MessageSquare className="size-5" />,
  msg91_sms: <MessageCircle className="size-5" />,
  hubspot: <BriefcaseBusiness className="size-5" />,
  zoho_crm: <BriefcaseBusiness className="size-5" />,
};

export function IntegrationsManager({ dashboard }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const crmDetails = dashboard.crmDetails ?? {};

  const getSummary = (provider: IntegrationProviderId) => {
    const item = dashboard.items.find((i) => i.provider === provider);
    return (item?.configSummary ?? {}) as Record<string, unknown>;
  };
  const getFieldMappings = (provider: "hubspot" | "zoho_crm") => {
    const summary = getSummary(provider);
    return (summary.fieldMappings && typeof summary.fieldMappings === "object" && !Array.isArray(summary.fieldMappings)
      ? summary.fieldMappings as Record<string, unknown>
      : {}) as Record<string, unknown>;
  };

  type FormState = Record<IntegrationProviderId, ProviderFormState>;
  const [forms, setForms] = useState<FormState>(() => ({
    ...{
      razorpay: {
        label: String(dashboard.items.find((i) => i.provider === "razorpay")?.configSummary.label ?? "Razorpay"),
      },
      google_calendar: {
        calendarId: String(dashboard.items.find((i) => i.provider === "google_calendar")?.configSummary.calendarId ?? "primary"),
        syncClasses: dashboard.items.find((i) => i.provider === "google_calendar")?.configSummary.syncClasses !== false,
        syncPtSessions: dashboard.items.find((i) => i.provider === "google_calendar")?.configSummary.syncPtSessions === true,
      },
      msg91_sms: {
        flowId: String(dashboard.items.find((i) => i.provider === "msg91_sms")?.configSummary.flowId ?? ""),
        senderId: String(dashboard.items.find((i) => i.provider === "msg91_sms")?.configSummary.senderId ?? ""),
        testMobile: String(dashboard.items.find((i) => i.provider === "msg91_sms")?.configSummary.testMobile ?? ""),
      },
      msg91_whatsapp: {
        integratedNumber: String(dashboard.items.find((i) => i.provider === "msg91_whatsapp")?.configSummary.integratedNumber ?? ""),
        templateName: String(dashboard.items.find((i) => i.provider === "msg91_whatsapp")?.configSummary.templateName ?? ""),
        namespace: "",
        languageCode: "en",
        testMobile: String(dashboard.items.find((i) => i.provider === "msg91_whatsapp")?.configSummary.testMobile ?? ""),
      },
      hubspot: {
        label: String(dashboard.items.find((i) => i.provider === "hubspot")?.configSummary.label ?? "HubSpot CRM"),
        portalId: String(dashboard.items.find((i) => i.provider === "hubspot")?.configSummary.portalId ?? ""),
        accessToken: "",
        clientSecret: "",
        syncLeads: dashboard.items.find((i) => i.provider === "hubspot")?.configSummary.syncLeads !== false,
        syncContacts: dashboard.items.find((i) => i.provider === "hubspot")?.configSummary.syncContacts !== false,
        testEmail: String(dashboard.items.find((i) => i.provider === "hubspot")?.configSummary.testEmail ?? ""),
        firstNameField: String(getFieldMappings("hubspot").firstNameField ?? "firstname"),
        lastNameField: String(getFieldMappings("hubspot").lastNameField ?? "lastname"),
        emailField: String(getFieldMappings("hubspot").emailField ?? "email"),
        phoneField: String(getFieldMappings("hubspot").phoneField ?? "phone"),
        notesField: String(getFieldMappings("hubspot").notesField ?? "hs_lead_status"),
        sourceField: String(getFieldMappings("hubspot").sourceField ?? "lifecyclestage"),
        statusField: String(getFieldMappings("hubspot").statusField ?? "hs_lead_status"),
      },
      zoho_crm: {
        label: String(dashboard.items.find((i) => i.provider === "zoho_crm")?.configSummary.label ?? "Zoho CRM"),
        accountsDomain: String(dashboard.items.find((i) => i.provider === "zoho_crm")?.configSummary.accountsDomain ?? "accounts.zoho.com"),
        accessToken: "",
        clientId: "",
        clientSecret: "",
        webhookSecret: "",
        refreshToken: "",
        syncLeads: dashboard.items.find((i) => i.provider === "zoho_crm")?.configSummary.syncLeads !== false,
        syncContacts: dashboard.items.find((i) => i.provider === "zoho_crm")?.configSummary.syncContacts !== false,
        testEmail: String(dashboard.items.find((i) => i.provider === "zoho_crm")?.configSummary.testEmail ?? ""),
        firstNameField: String(getFieldMappings("zoho_crm").firstNameField ?? "First_Name"),
        lastNameField: String(getFieldMappings("zoho_crm").lastNameField ?? "Last_Name"),
        emailField: String(getFieldMappings("zoho_crm").emailField ?? "Email"),
        phoneField: String(getFieldMappings("zoho_crm").phoneField ?? "Phone"),
        notesField: String(getFieldMappings("zoho_crm").notesField ?? "Description"),
        sourceField: String(getFieldMappings("zoho_crm").sourceField ?? "Lead_Source"),
        statusField: String(getFieldMappings("zoho_crm").statusField ?? "Lead_Status"),
      },
    }
  }) as FormState);

  const setField = (provider: IntegrationProviderId, patch: Partial<ProviderFormState>) => {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  };

  const refresh = () => startTransition(() => router.refresh());

  const runAction = async (provider: string, fn: () => Promise<{ status: "success" | "error"; message: string }>) => {
    setBusyProvider(provider);
    try {
      const result = await fn();
      showToast(result.message, result.status === "success" ? "success" : "error");
      refresh();
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {dashboard.items.map((item) => {
          const crmDetail = item.provider === "hubspot"
            ? crmDetails.hubspot ?? null
            : item.provider === "zoho_crm"
              ? crmDetails.zoho_crm ?? null
              : null;

          return (
          <Card key={item.provider} variant="elevated" className="overflow-hidden border-border/70">
            <CardHeader className="border-b border-border/60 bg-gradient-to-r from-surface to-surface-muted/70">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-accent/10 p-3 text-accent">
                    {ICON_MAP[item.provider]}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black tracking-tight">{item.title}</h3>
                      <Badge variant={item.status === "connected" ? "success" : item.status === "error" ? "error" : "neutral"}>
                        {item.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              {item.provider === "razorpay" && item.configSummary && Object.keys(item.configSummary).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(item.configSummary).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{formatLabel(key)}</p>
                      <p className="mt-2 text-sm font-bold text-foreground">{formatValue(value)}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(item.configSummary).filter(([, value]) => typeof value !== "object" || value === null).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-border/60 bg-background/80 p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{formatLabel(key)}</p>
                    <p className="mt-2 text-sm font-bold text-foreground">{formatValue(value)}</p>
                  </div>
                ))}
              </div>

              {item.errorMessage ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{item.errorMessage}</span>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/60 bg-surface/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Last activity</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{item.lastActivityAt ? new Date(item.lastActivityAt).toLocaleString("en-IN") : "No activity yet"}</p>
                  </div>
                  {item.whoConnected ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserRound className="size-3" />
                      <span>Connected by {item.whoConnected}</span>
                    </div>
                  ) : null}
                </div>
                {item.latestLogMessage ? (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Latest log: {item.latestLogStatus ? `${item.latestLogStatus} - ` : ""}{item.latestLogMessage}
                  </p>
                ) : null}
              </div>

              {item.provider === "razorpay" ? (
                <RazorpayConfigForm
                  state={forms.razorpay}
                  onChange={(patch) => setField("razorpay", patch)}
                  onSave={() => runAction("razorpay:save", async () => {
                    const form = new FormData();
                    form.set("keyId", forms.razorpay.keyId ?? "");
                    form.set("keySecret", forms.razorpay.keySecret ?? "");
                    form.set("webhookSecret", forms.razorpay.webhookSecret ?? "");
                    form.set("label", forms.razorpay.label ?? "Razorpay");
                    return saveOrgRazorpayIntegrationAction(form);
                  })}
                  onTest={() => runAction("razorpay:test", testOrgRazorpayIntegrationAction)}
                  onDisconnect={item.status !== "disconnected" ? () => runAction("razorpay:disconnect", disconnectOrgRazorpayIntegrationAction) : null}
                  loading={busyProvider?.startsWith("razorpay:") || isPending}
                />
              ) : null}

              {item.provider === "msg91_sms" ? (
                <SmsConfigForm
                  state={forms.msg91_sms}
                  onChange={(patch) => setField("msg91_sms", patch)}
                  onSave={() => runAction("msg91_sms:save", async () => {
                    const form = new FormData();
                    form.set("authKey", forms.msg91_sms.authKey ?? "");
                    form.set("flowId", forms.msg91_sms.flowId ?? "");
                    form.set("senderId", forms.msg91_sms.senderId ?? "");
                    form.set("testMobile", forms.msg91_sms.testMobile ?? "");
                    return saveOrgMsg91SmsIntegrationAction(form);
                  })}
                  onTest={() => runAction("msg91_sms:test", async () => {
                    const form = new FormData();
                    form.set("authKey", forms.msg91_sms.authKey ?? "");
                    form.set("flowId", forms.msg91_sms.flowId ?? "");
                    form.set("senderId", forms.msg91_sms.senderId ?? "");
                    form.set("testMobile", forms.msg91_sms.testMobile ?? "");
                    return testOrgMsg91SmsIntegrationAction(form);
                  })}
                  onDisconnect={item.status !== "disconnected" ? () => runAction("msg91_sms:disconnect", () => disconnectOrgProviderIntegrationAction("msg91_sms")) : null}
                  loading={busyProvider?.startsWith("msg91_sms:") || isPending}
                />
              ) : null}

              {item.provider === "msg91_whatsapp" ? (
                <WhatsAppConfigForm
                  state={forms.msg91_whatsapp}
                  onChange={(patch) => setField("msg91_whatsapp", patch)}
                  onSave={() => runAction("msg91_whatsapp:save", async () => {
                    const form = new FormData();
                    form.set("authKey", forms.msg91_whatsapp.authKey ?? "");
                    form.set("integratedNumber", forms.msg91_whatsapp.integratedNumber ?? "");
                    form.set("namespace", forms.msg91_whatsapp.namespace ?? "");
                    form.set("templateName", forms.msg91_whatsapp.templateName ?? "");
                    form.set("languageCode", forms.msg91_whatsapp.languageCode ?? "en");
                    form.set("testMobile", forms.msg91_whatsapp.testMobile ?? "");
                    return saveOrgMsg91WhatsAppIntegrationAction(form);
                  })}
                  onTest={() => runAction("msg91_whatsapp:test", async () => {
                    const form = new FormData();
                    form.set("authKey", forms.msg91_whatsapp.authKey ?? "");
                    form.set("integratedNumber", forms.msg91_whatsapp.integratedNumber ?? "");
                    form.set("namespace", forms.msg91_whatsapp.namespace ?? "");
                    form.set("templateName", forms.msg91_whatsapp.templateName ?? "");
                    form.set("languageCode", forms.msg91_whatsapp.languageCode ?? "en");
                    form.set("testMobile", forms.msg91_whatsapp.testMobile ?? "");
                    return testOrgMsg91WhatsAppIntegrationAction(form);
                  })}
                  onDisconnect={item.status !== "disconnected" ? () => runAction("msg91_whatsapp:disconnect", () => disconnectOrgProviderIntegrationAction("msg91_whatsapp")) : null}
                  loading={busyProvider?.startsWith("msg91_whatsapp:") || isPending}
                />
              ) : null}

              {item.provider === "google_calendar" ? (
                <GoogleCalendarForm
                  state={forms.google_calendar}
                  onChange={(patch) => setField("google_calendar", patch)}
                  onSave={() => runAction("google_calendar:save", async () => {
                    const form = new FormData();
                    form.set("calendarId", forms.google_calendar.calendarId ?? "primary");
                    form.set("syncClasses", String(forms.google_calendar.syncClasses !== false));
                    form.set("syncPtSessions", String(forms.google_calendar.syncPtSessions === true));
                    return saveOrgGoogleCalendarConfigAction(form);
                  })}
                  onConnect={async () => {
                    setBusyProvider("google_calendar:connect");
                    try {
                      const result = await getOrgGoogleCalendarAuthUrlAction();
                      if (result.status === "error" || !result.authUrl) {
                        showToast(result.message, "error");
                        return;
                      }
                      window.open(result.authUrl, "_blank", "noopener,noreferrer");
                      showToast(result.message, "info");
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : "Failed to open Google OAuth.", "error");
                    } finally {
                      setBusyProvider(null);
                    }
                  }}
                  onTest={() => runAction("google_calendar:test", testOrgGoogleCalendarIntegrationAction)}
                  onDisconnect={item.status !== "disconnected" ? () => runAction("google_calendar:disconnect", disconnectOrgGoogleCalendarIntegrationAction) : null}
                  loading={busyProvider?.startsWith("google_calendar:") || isPending}
                  blockedReason={item.status === "error" && item.errorMessage?.includes("OAuth") ? item.errorMessage : null}
                />
              ) : null}

              {item.provider === "hubspot" ? (
                <CrmConfigForm
                  provider="hubspot"
                  webhookUrl={item.webhookUrl}
                  state={forms.hubspot}
                  onChange={(patch) => setField("hubspot", patch)}
                  onSave={() => runAction("hubspot:save", async () => {
                    const form = new FormData();
                    form.set("label", forms.hubspot.label ?? "HubSpot CRM");
                    form.set("portalId", forms.hubspot.portalId ?? "");
                    form.set("accessToken", forms.hubspot.accessToken ?? "");
                    form.set("clientSecret", forms.hubspot.clientSecret ?? "");
                    form.set("firstNameField", forms.hubspot.firstNameField ?? "firstname");
                    form.set("lastNameField", forms.hubspot.lastNameField ?? "lastname");
                    form.set("emailField", forms.hubspot.emailField ?? "email");
                    form.set("phoneField", forms.hubspot.phoneField ?? "phone");
                    form.set("notesField", forms.hubspot.notesField ?? "hs_lead_status");
                    form.set("sourceField", forms.hubspot.sourceField ?? "lifecyclestage");
                    form.set("statusField", forms.hubspot.statusField ?? "hs_lead_status");
                    form.set("syncLeads", String(forms.hubspot.syncLeads !== false));
                    form.set("syncContacts", String(forms.hubspot.syncContacts !== false));
                    form.set("testEmail", forms.hubspot.testEmail ?? "");
                    return saveOrgCrmIntegrationAction("hubspot", form);
                  })}
                  onTest={() => runAction("hubspot:test", async () => {
                    const form = new FormData();
                    form.set("label", forms.hubspot.label ?? "HubSpot CRM");
                    form.set("portalId", forms.hubspot.portalId ?? "");
                    form.set("accessToken", forms.hubspot.accessToken ?? "");
                    form.set("clientSecret", forms.hubspot.clientSecret ?? "");
                    form.set("firstNameField", forms.hubspot.firstNameField ?? "firstname");
                    form.set("lastNameField", forms.hubspot.lastNameField ?? "lastname");
                    form.set("emailField", forms.hubspot.emailField ?? "email");
                    form.set("phoneField", forms.hubspot.phoneField ?? "phone");
                    form.set("notesField", forms.hubspot.notesField ?? "hs_lead_status");
                    form.set("sourceField", forms.hubspot.sourceField ?? "lifecyclestage");
                    form.set("statusField", forms.hubspot.statusField ?? "hs_lead_status");
                    form.set("syncLeads", String(forms.hubspot.syncLeads !== false));
                    form.set("syncContacts", String(forms.hubspot.syncContacts !== false));
                    form.set("testEmail", forms.hubspot.testEmail ?? "");
                    return testOrgCrmIntegrationAction("hubspot", form);
                  })}
                  onDisconnect={item.status !== "disconnected" ? () => runAction("hubspot:disconnect", () => disconnectOrgProviderIntegrationAction("hubspot")) : null}
                  loading={busyProvider?.startsWith("hubspot:") || isPending}
                />
              ) : null}

              {item.provider === "hubspot" && crmDetail ? (
                <CrmOperationsPanel
                  detail={crmDetail}
                  loading={busyProvider?.startsWith("hubspot:") || isPending}
                  onBackfill={() => runAction("hubspot:backfill", () => backfillOrgCrmLeadsAction(10))}
                  onRetryJob={(jobId) => runAction(`hubspot:retry:${jobId}`, () => retryOrgCrmSyncJobAction(jobId))}
                />
              ) : null}

              {item.provider === "zoho_crm" ? (
                <CrmConfigForm
                  provider="zoho_crm"
                  webhookUrl={item.webhookUrl}
                  state={forms.zoho_crm}
                  onChange={(patch) => setField("zoho_crm", patch)}
                  onSave={() => runAction("zoho_crm:save", async () => {
                    const form = new FormData();
                    form.set("label", forms.zoho_crm.label ?? "Zoho CRM");
                    form.set("accountsDomain", forms.zoho_crm.accountsDomain ?? "accounts.zoho.com");
                    form.set("accessToken", forms.zoho_crm.accessToken ?? "");
                    form.set("clientId", forms.zoho_crm.clientId ?? "");
                    form.set("clientSecret", forms.zoho_crm.clientSecret ?? "");
                    form.set("webhookSecret", forms.zoho_crm.webhookSecret ?? "");
                    form.set("refreshToken", forms.zoho_crm.refreshToken ?? "");
                    form.set("firstNameField", forms.zoho_crm.firstNameField ?? "First_Name");
                    form.set("lastNameField", forms.zoho_crm.lastNameField ?? "Last_Name");
                    form.set("emailField", forms.zoho_crm.emailField ?? "Email");
                    form.set("phoneField", forms.zoho_crm.phoneField ?? "Phone");
                    form.set("notesField", forms.zoho_crm.notesField ?? "Description");
                    form.set("sourceField", forms.zoho_crm.sourceField ?? "Lead_Source");
                    form.set("statusField", forms.zoho_crm.statusField ?? "Lead_Status");
                    form.set("syncLeads", String(forms.zoho_crm.syncLeads !== false));
                    form.set("syncContacts", String(forms.zoho_crm.syncContacts !== false));
                    form.set("testEmail", forms.zoho_crm.testEmail ?? "");
                    return saveOrgCrmIntegrationAction("zoho_crm", form);
                  })}
                  onTest={() => runAction("zoho_crm:test", async () => {
                    const form = new FormData();
                    form.set("label", forms.zoho_crm.label ?? "Zoho CRM");
                    form.set("accountsDomain", forms.zoho_crm.accountsDomain ?? "accounts.zoho.com");
                    form.set("accessToken", forms.zoho_crm.accessToken ?? "");
                    form.set("clientId", forms.zoho_crm.clientId ?? "");
                    form.set("clientSecret", forms.zoho_crm.clientSecret ?? "");
                    form.set("webhookSecret", forms.zoho_crm.webhookSecret ?? "");
                    form.set("refreshToken", forms.zoho_crm.refreshToken ?? "");
                    form.set("firstNameField", forms.zoho_crm.firstNameField ?? "First_Name");
                    form.set("lastNameField", forms.zoho_crm.lastNameField ?? "Last_Name");
                    form.set("emailField", forms.zoho_crm.emailField ?? "Email");
                    form.set("phoneField", forms.zoho_crm.phoneField ?? "Phone");
                    form.set("notesField", forms.zoho_crm.notesField ?? "Description");
                    form.set("sourceField", forms.zoho_crm.sourceField ?? "Lead_Source");
                    form.set("statusField", forms.zoho_crm.statusField ?? "Lead_Status");
                    form.set("syncLeads", String(forms.zoho_crm.syncLeads !== false));
                    form.set("syncContacts", String(forms.zoho_crm.syncContacts !== false));
                    form.set("testEmail", forms.zoho_crm.testEmail ?? "");
                    return testOrgCrmIntegrationAction("zoho_crm", form);
                  })}
                  onDisconnect={item.status !== "disconnected" ? () => runAction("zoho_crm:disconnect", () => disconnectOrgProviderIntegrationAction("zoho_crm")) : null}
                  loading={busyProvider?.startsWith("zoho_crm:") || isPending}
                />
              ) : null}

              {item.provider === "zoho_crm" && crmDetail ? (
                <CrmOperationsPanel
                  detail={crmDetail}
                  loading={busyProvider?.startsWith("zoho_crm:") || isPending}
                  onBackfill={() => runAction("zoho_crm:backfill", () => backfillOrgCrmLeadsAction(10))}
                  onRetryJob={(jobId) => runAction(`zoho_crm:retry:${jobId}`, () => retryOrgCrmSyncJobAction(jobId))}
                />
              ) : null}
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}

function RazorpayConfigForm({
  state, onChange, onSave, onTest, onDisconnect, loading,
}: {
  state: ProviderFormState;
  onChange: (patch: Partial<ProviderFormState>) => void;
  onSave: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Razorpay Key ID" value={state.keyId ?? ""} onChange={(e) => onChange({ keyId: e.target.value })} />
        <Input placeholder="Razorpay Key Secret" type="password" value={state.keySecret ?? ""} onChange={(e) => onChange({ keySecret: e.target.value })} />
        <Input placeholder="Webhook Secret (optional)" type="password" value={state.webhookSecret ?? ""} onChange={(e) => onChange({ webhookSecret: e.target.value })} />
        <Input placeholder="Account label (optional)" value={state.label ?? "Razorpay"} onChange={(e) => onChange({ label: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button loading={loading} size="sm" variant="secondary" onClick={onSave}>Save credentials</Button>
        <Button loading={loading} size="sm" variant="accent" onClick={onTest}>
          <CheckCircle2 className="size-4" />
          Test connection
        </Button>
        {onDisconnect ? (
          <Button loading={loading} size="sm" variant="ghost" onClick={onDisconnect}>
            <Link2Off className="size-4" />
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SmsConfigForm({
  state, onChange, onSave, onTest, onDisconnect, loading,
}: {
  state: ProviderFormState;
  onChange: (patch: Partial<ProviderFormState>) => void;
  onSave: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="MSG91 Auth Key" type="password" value={state.authKey ?? ""} onChange={(e) => onChange({ authKey: e.target.value })} />
        <Input placeholder="Flow ID" value={state.flowId ?? ""} onChange={(e) => onChange({ flowId: e.target.value })} />
        <Input placeholder="Sender ID (optional)" value={state.senderId ?? ""} onChange={(e) => onChange({ senderId: e.target.value })} />
        <Input placeholder="Test mobile (91xxxxxxxxxx)" value={state.testMobile ?? ""} onChange={(e) => onChange({ testMobile: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button loading={loading} size="sm" variant="secondary" onClick={onSave}>Save config</Button>
        <Button loading={loading} size="sm" variant="accent" onClick={onTest}>Send test SMS</Button>
        {onDisconnect ? (
          <Button loading={loading} size="sm" variant="ghost" onClick={onDisconnect}>
            <Link2Off className="size-4" />
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function WhatsAppConfigForm({
  state, onChange, onSave, onTest, onDisconnect, loading,
}: {
  state: ProviderFormState;
  onChange: (patch: Partial<ProviderFormState>) => void;
  onSave: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="MSG91 Auth Key" type="password" value={state.authKey ?? ""} onChange={(e) => onChange({ authKey: e.target.value })} />
        <Input placeholder="Integrated WhatsApp number" value={state.integratedNumber ?? ""} onChange={(e) => onChange({ integratedNumber: e.target.value })} />
        <Input placeholder="Template namespace" value={state.namespace ?? ""} onChange={(e) => onChange({ namespace: e.target.value })} />
        <Input placeholder="Template name" value={state.templateName ?? ""} onChange={(e) => onChange({ templateName: e.target.value })} />
        <Input placeholder="Language code" value={state.languageCode ?? "en"} onChange={(e) => onChange({ languageCode: e.target.value })} />
        <Input placeholder="Test mobile (91xxxxxxxxxx)" value={state.testMobile ?? ""} onChange={(e) => onChange({ testMobile: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button loading={loading} size="sm" variant="secondary" onClick={onSave}>Save config</Button>
        <Button loading={loading} size="sm" variant="accent" onClick={onTest}>Send test WhatsApp</Button>
        {onDisconnect ? (
          <Button loading={loading} size="sm" variant="ghost" onClick={onDisconnect}>
            <Link2Off className="size-4" />
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GoogleCalendarForm({
  state, onChange, onSave, onConnect, onTest, onDisconnect, loading, blockedReason,
}: {
  state: ProviderFormState;
  onChange: (patch: Partial<ProviderFormState>) => void;
  onSave: () => void;
  onConnect: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
  blockedReason: string | null;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4">
      {blockedReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {blockedReason}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Calendar ID" value={state.calendarId ?? "primary"} onChange={(e) => onChange({ calendarId: e.target.value })} />
        <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold">
          <input checked={state.syncClasses !== false} type="checkbox" onChange={(e) => onChange({ syncClasses: e.target.checked })} />
          Sync classes
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold">
          <input checked={state.syncPtSessions === true} type="checkbox" onChange={(e) => onChange({ syncPtSessions: e.target.checked })} />
          Sync PT sessions
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button loading={loading} size="sm" variant="secondary" onClick={onSave}>Save config</Button>
        <Button loading={loading} size="sm" variant="accent" onClick={onConnect}>
          <ExternalLink className="size-4" />
          Connect Google
        </Button>
        <Button loading={loading} size="sm" variant="secondary" onClick={onTest}>
          <RefreshCw className="size-4" />
          Test calendar
        </Button>
        {onDisconnect ? (
          <Button loading={loading} size="sm" variant="ghost" onClick={onDisconnect}>
            <Link2Off className="size-4" />
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CrmConfigForm({
  provider,
  webhookUrl,
  state,
  onChange,
  onSave,
  onTest,
  onDisconnect,
  loading,
}: {
  provider: "hubspot" | "zoho_crm";
  webhookUrl: string | null;
  state: ProviderFormState;
  onChange: (patch: Partial<ProviderFormState>) => void;
  onSave: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
}) {
  if (provider === "hubspot") {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="HubSpot access token" type="password" value={state.accessToken ?? ""} onChange={(e) => onChange({ accessToken: e.target.value })} />
          <Input placeholder="HubSpot client secret" type="password" value={state.clientSecret ?? ""} onChange={(e) => onChange({ clientSecret: e.target.value })} />
          <Input placeholder="Portal ID (optional)" value={state.portalId ?? ""} onChange={(e) => onChange({ portalId: e.target.value })} />
          <Input placeholder="Label" value={state.label ?? "HubSpot CRM"} onChange={(e) => onChange({ label: e.target.value })} />
          <Input placeholder="Test email (optional)" value={state.testEmail ?? ""} onChange={(e) => onChange({ testEmail: e.target.value })} />
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/70 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Field mapping</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input placeholder="First name field" value={state.firstNameField ?? "firstname"} onChange={(e) => onChange({ firstNameField: e.target.value })} />
            <Input placeholder="Last name field" value={state.lastNameField ?? "lastname"} onChange={(e) => onChange({ lastNameField: e.target.value })} />
            <Input placeholder="Email field" value={state.emailField ?? "email"} onChange={(e) => onChange({ emailField: e.target.value })} />
            <Input placeholder="Phone field" value={state.phoneField ?? "phone"} onChange={(e) => onChange({ phoneField: e.target.value })} />
            <Input placeholder="Notes field" value={state.notesField ?? "hs_lead_status"} onChange={(e) => onChange({ notesField: e.target.value })} />
            <Input placeholder="Source field" value={state.sourceField ?? "lifecyclestage"} onChange={(e) => onChange({ sourceField: e.target.value })} />
            <Input placeholder="Status field" value={state.statusField ?? "hs_lead_status"} onChange={(e) => onChange({ statusField: e.target.value })} />
          </div>
        </div>
        {webhookUrl ? (
          <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            Webhook URL: <span className="font-mono text-foreground">{webhookUrl}</span>
            <p className="mt-1">HubSpot validates requests with X-HubSpot-Signature-V3 using the client secret above.</p>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold">
            <input checked={state.syncLeads !== false} type="checkbox" onChange={(e) => onChange({ syncLeads: e.target.checked })} />
            Sync leads
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold">
            <input checked={state.syncContacts !== false} type="checkbox" onChange={(e) => onChange({ syncContacts: e.target.checked })} />
            Sync contacts
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button loading={loading} size="sm" variant="secondary" onClick={onSave}>Save config</Button>
          <Button loading={loading} size="sm" variant="accent" onClick={onTest}>Test HubSpot</Button>
          {onDisconnect ? (
            <Button loading={loading} size="sm" variant="ghost" onClick={onDisconnect}>
              <Link2Off className="size-4" />
              Disconnect
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Zoho label" value={state.label ?? "Zoho CRM"} onChange={(e) => onChange({ label: e.target.value })} />
        <Input placeholder="Accounts domain" value={state.accountsDomain ?? "accounts.zoho.com"} onChange={(e) => onChange({ accountsDomain: e.target.value })} />
        <Input placeholder="Access token (optional)" type="password" value={state.accessToken ?? ""} onChange={(e) => onChange({ accessToken: e.target.value })} />
        <Input placeholder="Refresh token" type="password" value={state.refreshToken ?? ""} onChange={(e) => onChange({ refreshToken: e.target.value })} />
        <Input placeholder="Client ID" value={state.clientId ?? ""} onChange={(e) => onChange({ clientId: e.target.value })} />
        <Input placeholder="Client Secret" type="password" value={state.clientSecret ?? ""} onChange={(e) => onChange({ clientSecret: e.target.value })} />
        <Input placeholder="Webhook Secret" type="password" value={state.webhookSecret ?? ""} onChange={(e) => onChange({ webhookSecret: e.target.value })} />
        <Input placeholder="Test email (optional)" value={state.testEmail ?? ""} onChange={(e) => onChange({ testEmail: e.target.value })} />
      </div>
      <div className="rounded-xl border border-border/60 bg-surface/70 p-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Field mapping</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input placeholder="First name field" value={state.firstNameField ?? "First_Name"} onChange={(e) => onChange({ firstNameField: e.target.value })} />
          <Input placeholder="Last name field" value={state.lastNameField ?? "Last_Name"} onChange={(e) => onChange({ lastNameField: e.target.value })} />
          <Input placeholder="Email field" value={state.emailField ?? "Email"} onChange={(e) => onChange({ emailField: e.target.value })} />
          <Input placeholder="Phone field" value={state.phoneField ?? "Phone"} onChange={(e) => onChange({ phoneField: e.target.value })} />
          <Input placeholder="Notes field" value={state.notesField ?? "Description"} onChange={(e) => onChange({ notesField: e.target.value })} />
          <Input placeholder="Source field" value={state.sourceField ?? "Lead_Source"} onChange={(e) => onChange({ sourceField: e.target.value })} />
          <Input placeholder="Status field" value={state.statusField ?? "Lead_Status"} onChange={(e) => onChange({ statusField: e.target.value })} />
        </div>
      </div>
      {webhookUrl ? (
        <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          Webhook URL: <span className="font-mono text-foreground">{webhookUrl}</span>
          <p className="mt-1">Configure Zoho to send a matching X-CRM-Webhook-Secret header for inbound verification.</p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold">
          <input checked={state.syncLeads !== false} type="checkbox" onChange={(e) => onChange({ syncLeads: e.target.checked })} />
          Sync leads
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold">
          <input checked={state.syncContacts !== false} type="checkbox" onChange={(e) => onChange({ syncContacts: e.target.checked })} />
          Sync contacts
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button loading={loading} size="sm" variant="secondary" onClick={onSave}>Save config</Button>
        <Button loading={loading} size="sm" variant="accent" onClick={onTest}>Test Zoho</Button>
        {onDisconnect ? (
          <Button loading={loading} size="sm" variant="ghost" onClick={onDisconnect}>
            <Link2Off className="size-4" />
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CrmOperationsPanel({
  detail,
  onBackfill,
  onRetryJob,
  loading,
}: {
  detail: CrmIntegrationDetail;
  onBackfill: () => void;
  onRetryJob: (jobId: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-surface/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Sync health</p>
          <h4 className="mt-1 text-lg font-black tracking-tight">{detail.title}</h4>
          <p className="text-sm text-muted-foreground">
            {detail.health.connected ? "Connected" : "Disconnected"}
            {detail.health.stale ? " · Stale" : " · Fresh"}
            {detail.errorMessage ? ` · ${detail.errorMessage}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button loading={loading} size="sm" variant="secondary" onClick={onBackfill}>
            <RotateCcw className="size-4" />
            Queue latest leads
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Pending jobs" value={detail.health.pendingJobs} />
        <Metric title="Failed jobs" value={detail.health.failedJobs} />
        <Metric title="Webhook failures" value={detail.health.webhookFailures} />
        <Metric title="Mapped leads" value={detail.health.mappedLeads} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Field mapping</h5>
            <span className="text-xs text-muted-foreground">Used by outbound sync</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(detail.fieldMappings).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-border bg-surface px-3 py-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{formatLabel(key)}</p>
                <p className="mt-1 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Recent webhook events</h5>
            <Webhook className="size-4 text-muted-foreground" />
          </div>
          {detail.recentWebhookEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhook events recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.recentWebhookEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{event.eventType}</p>
                    <span className="text-xs text-muted-foreground">{event.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Event {event.eventId} · Lead {event.externalObjectId}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Recent sync jobs</h5>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          {detail.recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync jobs found.</p>
          ) : (
            <div className="space-y-2">
              {detail.recentJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{job.eventType}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.status} · attempts {job.attempts}/{job.maxAttempts}
                      </p>
                    </div>
                    {job.status !== "succeeded" ? (
                      <Button loading={loading} size="sm" variant="secondary" onClick={() => onRetryJob(job.id)}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                  {job.lastError ? <p className="mt-1 text-xs text-red-600">{job.lastError}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Recent mappings & leads</h5>
            <Database className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {detail.recentMappings.slice(0, 4).map((mapping) => (
              <div key={mapping.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                <p className="text-sm font-semibold">{mapping.entityId} → {mapping.externalObjectType}:{mapping.externalId}</p>
                <p className="text-xs text-muted-foreground">{mapping.syncStatus} · {mapping.lastSyncedAt ? new Date(mapping.lastSyncedAt).toLocaleString("en-IN") : "Not synced"}</p>
              </div>
            ))}
            {detail.recentMappings.length === 0 ? <p className="text-sm text-muted-foreground">No mappings yet.</p> : null}
          </div>
          <div className="space-y-2">
            {detail.recentLeads.slice(0, 4).map((lead) => (
              <div key={lead.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                <p className="text-sm font-semibold">{lead.name}</p>
                <p className="text-xs text-muted-foreground">{lead.email ?? "No email"} · {lead.status ?? "No status"} · {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString("en-IN") : "No updated time"}</p>
              </div>
            ))}
            {detail.recentLeads.length === 0 ? <p className="text-sm text-muted-foreground">No recent leads found.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function formatLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
}

function formatValue(value: string | boolean | null) {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === null || value === "") return "Not set";
  return String(value);
}
