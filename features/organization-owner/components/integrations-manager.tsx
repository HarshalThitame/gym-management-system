"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Link2Off,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import type { IntegrationDashboardData } from "../actions/integration-actions";
import type { IntegrationProviderId } from "@/features/integrations/services/integrations-service";
import {
  disconnectOrgGoogleCalendarIntegrationAction,
  disconnectOrgProviderIntegrationAction,
  getOrgGoogleCalendarAuthUrlAction,
  saveOrgGoogleCalendarConfigAction,
  saveOrgMsg91SmsIntegrationAction,
  saveOrgMsg91WhatsAppIntegrationAction,
  saveOrgRazorpayIntegrationAction,
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
  label?: string;
};

const ICON_MAP: Record<IntegrationProviderId, ReactNode> = {
  razorpay: <CreditCard className="size-5" />,
  google_calendar: <CalendarDays className="size-5" />,
  msg91_whatsapp: <MessageSquare className="size-5" />,
  msg91_sms: <MessageCircle className="size-5" />,
};

export function IntegrationsManager({ dashboard }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const initialForms = useMemo<Record<string, ProviderFormState>>(() => ({
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
  }), [dashboard.items]);

  type FormState = Record<IntegrationProviderId, ProviderFormState>;
  const [forms, setForms] = useState<FormState>(initialForms as FormState);

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
        {dashboard.items.map((item) => (
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
                {Object.entries(item.configSummary).filter(([k]) => item.provider !== "razorpay" || k === "").map(([key, value]) => (
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
            </CardContent>
          </Card>
        ))}
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

function formatLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
}

function formatValue(value: string | boolean | null) {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === null || value === "") return "Not set";
  return String(value);
}
