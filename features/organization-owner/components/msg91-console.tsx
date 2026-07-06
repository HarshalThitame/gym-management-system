"use client";

import { useRouter } from "next/navigation";
import { Children, useState, useTransition, type ReactNode } from "react";
import {
  Activity,
  CheckCircle2,
  Link2Off,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { showToast } from "@/components/ui/toast";
import type { Msg91ConsoleChannel, Msg91ConsoleData, Msg91ConsoleDelivery, Msg91ConsoleLog } from "../services/msg91-console-service";
import {
  disconnectOrgProviderIntegrationAction,
  saveOrgMsg91SmsIntegrationAction,
  saveOrgMsg91WhatsAppIntegrationAction,
  testOrgMsg91SmsIntegrationAction,
  testOrgMsg91WhatsAppIntegrationAction,
} from "../actions/integration-actions";

type Props = {
  consoleData: Msg91ConsoleData;
};

type SmsFormState = {
  authKey: string;
  flowId: string;
  senderId: string;
  testMobile: string;
};

type WhatsAppFormState = {
  authKey: string;
  integratedNumber: string;
  namespace: string;
  templateName: string;
  languageCode: string;
  testMobile: string;
};

export function Msg91Console({ consoleData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [smsForm, setSmsForm] = useState<SmsFormState>(() => ({
    authKey: "",
    flowId: String(consoleData.sms.configSummary.flowId ?? ""),
    senderId: String(consoleData.sms.configSummary.senderId ?? ""),
    testMobile: String(consoleData.sms.configSummary.testMobile ?? ""),
  }));
  const [whatsAppForm, setWhatsAppForm] = useState<WhatsAppFormState>(() => ({
    authKey: "",
    integratedNumber: String(consoleData.whatsapp.configSummary.integratedNumber ?? ""),
    namespace: "",
    templateName: String(consoleData.whatsapp.configSummary.templateName ?? ""),
    languageCode: "en",
    testMobile: String(consoleData.whatsapp.configSummary.testMobile ?? ""),
  }));

  const refresh = () => startTransition(() => router.refresh());

  const runAction = async (
    actionKey: string,
    fn: () => Promise<{ status: "success" | "error"; message: string }>,
  ) => {
    setBusyAction(actionKey);
    try {
      const result = await fn();
      showToast(result.message, result.status === "success" ? "success" : "error");
      refresh();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border/60 bg-gradient-to-br from-surface via-surface to-surface-muted/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Waves className="size-3.5" />
              Standalone MSG91 Console
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Provider Operations</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">MSG91 SMS and WhatsApp control plane</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Configure India-first SMS and WhatsApp delivery, validate flow/template setup, inspect provider activity, and trace recent delivery events from one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/organization/integrations" variant="secondary">
              Back to integrations
            </ButtonLink>
            <ButtonLink href="/admin/communications" variant="accent">
              Open communications hub
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Connected MSG91 channels" icon={<CheckCircle2 className="size-5" />} label="Connected" value={String(consoleData.metrics.connectedChannels)} />
        <StatCard detail="Channels needing attention" icon={<ShieldAlert className="size-5" />} label="Issues" value={String(consoleData.metrics.errorChannels)} />
        <StatCard detail="Recent delivery events" icon={<MessageSquare className="size-5" />} label="Deliveries" value={String(consoleData.metrics.totalDeliveries)} />
        <StatCard detail="Stale or inactive channels" icon={<Activity className="size-5" />} label="Stale" value={String(consoleData.metrics.staleChannels)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProviderCard
          channel={consoleData.sms}
          icon={<MessageCircle className="size-5" />}
          title="MSG91 SMS"
          description="DLT-aware flow delivery for attendance, reminders, and campaign notifications."
          form={smsForm}
          onChange={(patch) => setSmsForm((prev) => ({ ...prev, ...patch }))}
          onSave={() => runAction("msg91_sms:save", async () => {
            const form = new FormData();
            form.set("authKey", smsForm.authKey);
            form.set("flowId", smsForm.flowId);
            form.set("senderId", smsForm.senderId);
            form.set("testMobile", smsForm.testMobile);
            return saveOrgMsg91SmsIntegrationAction(form);
          })}
          onTest={() => runAction("msg91_sms:test", async () => {
            const form = new FormData();
            form.set("authKey", smsForm.authKey);
            form.set("flowId", smsForm.flowId);
            form.set("senderId", smsForm.senderId);
            form.set("testMobile", smsForm.testMobile);
            return testOrgMsg91SmsIntegrationAction(form);
          })}
          onDisconnect={consoleData.sms.status !== "disconnected" ? () => runAction("msg91_sms:disconnect", () => disconnectOrgProviderIntegrationAction("msg91_sms")) : null}
          loading={busyAction?.startsWith("msg91_sms:") || isPending}
        />

        <ProviderCard
          channel={consoleData.whatsapp}
          icon={<MessageSquare className="size-5" />}
          title="MSG91 WhatsApp"
          description="Template-based WhatsApp messaging for member campaigns, reminders, and operational alerts."
          form={whatsAppForm}
          onChange={(patch) => setWhatsAppForm((prev) => ({ ...prev, ...patch }))}
          onSave={() => runAction("msg91_whatsapp:save", async () => {
            const form = new FormData();
            form.set("authKey", whatsAppForm.authKey);
            form.set("integratedNumber", whatsAppForm.integratedNumber);
            form.set("namespace", whatsAppForm.namespace);
            form.set("templateName", whatsAppForm.templateName);
            form.set("languageCode", whatsAppForm.languageCode);
            form.set("testMobile", whatsAppForm.testMobile);
            return saveOrgMsg91WhatsAppIntegrationAction(form);
          })}
          onTest={() => runAction("msg91_whatsapp:test", async () => {
            const form = new FormData();
            form.set("authKey", whatsAppForm.authKey);
            form.set("integratedNumber", whatsAppForm.integratedNumber);
            form.set("namespace", whatsAppForm.namespace);
            form.set("templateName", whatsAppForm.templateName);
            form.set("languageCode", whatsAppForm.languageCode);
            form.set("testMobile", whatsAppForm.testMobile);
            return testOrgMsg91WhatsAppIntegrationAction(form);
          })}
          onDisconnect={consoleData.whatsapp.status !== "disconnected" ? () => runAction("msg91_whatsapp:disconnect", () => disconnectOrgProviderIntegrationAction("msg91_whatsapp")) : null}
          loading={busyAction?.startsWith("msg91_whatsapp:") || isPending}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TimelineCard
          title="Recent delivery history"
          description="Last outbound SMS and WhatsApp events across the organization."
          emptyMessage="No delivery history found yet."
          icon={<Send className="size-5" />}
        >
          {consoleData.recentDeliveries.map((delivery) => (
            <DeliveryRow key={delivery.id} delivery={delivery} />
          ))}
        </TimelineCard>

        <TimelineCard
          title="Provider activity"
          description="Latest integration log entries for SMS and WhatsApp."
          emptyMessage="No provider logs found yet."
          icon={<RefreshCw className="size-5" />}
        >
          {[...consoleData.sms.recentLogs.map((log) => ({ ...log, provider: "MSG91 SMS", color: "sms" as const })), ...consoleData.whatsapp.recentLogs.map((log) => ({ ...log, provider: "MSG91 WhatsApp", color: "whatsapp" as const }))].slice(0, 12).map((log) => (
            <LogRow key={`${log.provider}-${log.id}`} log={log} />
          ))}
        </TimelineCard>
      </div>

      <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-surface to-surface-muted/70 p-5">
        <div className="space-y-2 text-sm text-muted-foreground">
          <h3 className="text-lg font-black text-foreground">Operational Notes</h3>
          <p>SMS uses approved MSG91 flow IDs and sender IDs. WhatsApp uses approved MSG91 template names, namespaces, and integrated numbers.</p>
          <p>Use the console to validate configuration, then send a test message before enabling campaigns or automated gym notifications.</p>
          <p>The general integrations hub still handles payment, calendar, and CRM providers; this console is dedicated to MSG91 operations only.</p>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  channel,
  icon,
  title,
  description,
  form,
  onChange,
  onSave,
  onTest,
  onDisconnect,
  loading,
}: {
  channel: Msg91ConsoleChannel;
  icon: React.ReactNode;
  title: string;
  description: string;
  form: SmsFormState | WhatsAppFormState;
  onChange: (patch: Partial<SmsFormState> | Partial<WhatsAppFormState>) => void;
  onSave: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
}) {
  return (
    <Card variant="elevated" className="overflow-hidden border-border/70">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-surface to-surface-muted/70">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-accent/10 p-3 text-accent">{icon}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black tracking-tight">{title}</h3>
                <Badge variant={channel.status === "connected" ? "success" : channel.status === "error" ? "error" : "neutral"}>{channel.statusLabel}</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>
          <ButtonLink href="/organization/integrations" size="sm" variant="secondary">
            Open hub
          </ButtonLink>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(channel.configSummary).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-border/60 bg-background/80 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{formatLabel(key)}</p>
              <p className="mt-2 text-sm font-bold text-foreground">{formatValue(value)}</p>
            </div>
          ))}
          {Object.keys(channel.configSummary).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 p-3 text-sm text-muted-foreground sm:col-span-2">
              No saved configuration yet. Save credentials to populate the console.
            </div>
          ) : null}
        </div>

        {channel.errorMessage ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>{channel.errorMessage}</span>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border/60 bg-surface/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Last activity</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{channel.lastActivityAt ? new Date(channel.lastActivityAt).toLocaleString("en-IN") : "No activity yet"}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="size-3.5" />
              <span>{channel.latestLogStatus ? `${channel.latestLogStatus.toUpperCase()} · ` : ""}{channel.latestLogMessage ?? "No log entries yet"}</span>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Latest log time: {channel.latestLogAt ? new Date(channel.latestLogAt).toLocaleString("en-IN") : "N/A"}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4">
          {channel.provider === "msg91_sms" ? (
            <SmsConfigForm state={form as SmsFormState} onChange={onChange} onDisconnect={onDisconnect} onSave={onSave} onTest={onTest} loading={loading} />
          ) : (
            <WhatsAppConfigForm state={form as WhatsAppFormState} onChange={onChange} onDisconnect={onDisconnect} onSave={onSave} onTest={onTest} loading={loading} />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Recent logs</h4>
            <span className="text-xs text-muted-foreground">{channel.recentLogs.length} entries</span>
          </div>
          <div className="space-y-2">
            {channel.recentLogs.length > 0 ? channel.recentLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-border/60 bg-surface/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{log.action}</p>
                  <Badge variant={log.status === "success" ? "success" : log.status === "error" ? "error" : "neutral"}>{log.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                {log.errorMessage ? <p className="mt-2 text-xs leading-5 text-red-700">{log.errorMessage}</p> : null}
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background px-4 py-5 text-sm text-muted-foreground">
                No provider logs available yet.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button loading={loading} size="sm" variant="secondary" onClick={onSave}>Save config</Button>
          <Button loading={loading} size="sm" variant="accent" onClick={onTest}><CheckCircle2 className="size-4" /> Send test</Button>
          {onDisconnect ? (
            <Button loading={loading} size="sm" variant="ghost" onClick={onDisconnect}>
              <Link2Off className="size-4" />
              Disconnect
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SmsConfigForm({
  state,
  onChange,
  onSave,
  onTest,
  onDisconnect,
  loading,
}: {
  state: SmsFormState;
  onChange: (patch: Partial<SmsFormState>) => void;
  onSave: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="MSG91 Auth Key" type="password" value={state.authKey} onChange={(e) => onChange({ authKey: e.target.value })} />
        <Input placeholder="Flow ID" value={state.flowId} onChange={(e) => onChange({ flowId: e.target.value })} />
        <Input placeholder="Sender ID (optional)" value={state.senderId} onChange={(e) => onChange({ senderId: e.target.value })} />
        <Input placeholder="Test mobile (91xxxxxxxxxx)" value={state.testMobile} onChange={(e) => onChange({ testMobile: e.target.value })} />
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
  state,
  onChange,
  onSave,
  onTest,
  onDisconnect,
  loading,
}: {
  state: WhatsAppFormState;
  onChange: (patch: Partial<WhatsAppFormState>) => void;
  onSave: () => void;
  onTest: () => void;
  onDisconnect: (() => void) | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="MSG91 Auth Key" type="password" value={state.authKey} onChange={(e) => onChange({ authKey: e.target.value })} />
        <Input placeholder="Integrated WhatsApp number" value={state.integratedNumber} onChange={(e) => onChange({ integratedNumber: e.target.value })} />
        <Input placeholder="Template namespace" value={state.namespace} onChange={(e) => onChange({ namespace: e.target.value })} />
        <Input placeholder="Template name" value={state.templateName} onChange={(e) => onChange({ templateName: e.target.value })} />
        <Input placeholder="Language code" value={state.languageCode} onChange={(e) => onChange({ languageCode: e.target.value })} />
        <Input placeholder="Test mobile (91xxxxxxxxxx)" value={state.testMobile} onChange={(e) => onChange({ testMobile: e.target.value })} />
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

function TimelineCard({
  title,
  description,
  emptyMessage,
  icon,
  children,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  icon: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="elevated" className="overflow-hidden border-border/70">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-surface to-surface-muted/70">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-accent/10 p-3 text-accent">{icon}</div>
          <div>
            <h3 className="text-xl font-black tracking-tight">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {Children.count(children) > 0 ? children : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeliveryRow({ delivery }: { delivery: Msg91ConsoleDelivery }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={delivery.channel === "sms" ? "neutral" : "info"}>{delivery.channel.toUpperCase()}</Badge>
            <Badge variant={delivery.status === "failed" ? "error" : delivery.status === "sent" || delivery.status === "delivered" ? "success" : "neutral"}>{delivery.status}</Badge>
          </div>
          <p className="text-sm font-semibold text-foreground">{delivery.gymName ?? "All gyms"}{delivery.branchId ? ` · Branch ${delivery.branchId.slice(0, 8)}` : ""}</p>
          <p className="text-xs text-muted-foreground">{delivery.category} · {delivery.direction} · {new Date(delivery.createdAt).toLocaleString("en-IN")}</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{delivery.preview || "No body preview available."}</p>
    </div>
  );
}

function LogRow({ log }: { log: Msg91ConsoleLog & { provider: string; color: "sms" | "whatsapp" } }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={log.color === "sms" ? "neutral" : "info"}>{log.provider}</Badge>
            <Badge variant={log.status === "success" ? "success" : log.status === "error" ? "error" : "neutral"}>{log.status}</Badge>
          </div>
          <p className="text-sm font-semibold text-foreground">{log.action}</p>
          <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
        </div>
      </div>
      {log.errorMessage ? <p className="mt-2 text-xs leading-5 text-red-700">{log.errorMessage}</p> : null}
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
}

function formatValue(value: string | boolean | null) {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === null || value === "") return "Not set";
  return String(value);
}
