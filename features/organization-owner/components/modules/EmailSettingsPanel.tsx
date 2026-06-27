"use client";

import { useEffect, useActionState, useState } from "react";
import { CheckCircle2, Copy, Globe2, Loader2, Mail, Plus, Send, Trash2, XCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveEmailSettingsAction, sendTestEmailAction } from "@/features/organization-owner/actions/email-settings-actions";
import {
  addEmailSendingDomainAction,
  verifyEmailSendingDomainAction,
  removeEmailSendingDomainAction,
} from "@/features/organization-owner/actions/email-domain-actions";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type EmailSettingsPanelProps = { dashboard: OrganizationOwnerDashboard };
type DomainRow = Database["public"]["Tables"]["tenant_domains"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function EmailSettingsPanel({ dashboard }: EmailSettingsPanelProps) {
  const tenantConfigs = dashboard.tenantConfigs;
  const activeConfig = tenantConfigs.find((c) => c.status === "active") ?? tenantConfigs[0];
  const emailBranding = (activeConfig?.email_branding ?? {}) as Record<string, unknown>;
  const orgId = dashboard.organization.id;

  const allDomains = dashboard.tenantDomains.filter((d) => d.domain_type === "email_sending");

  const [domains, setDomains] = useState<DomainRow[]>(allDomains);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  const [settingsState, settingsAction, settingsPending] = useActionState(saveEmailSettingsAction, initialAuthActionState);
  const [testState, testAction, testPending] = useActionState(sendTestEmailAction, initialAuthActionState);
  const [addDomainState, addDomainAction, addDomainPending] = useActionState(addEmailSendingDomainAction, initialAuthActionState);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyEmailSendingDomainAction, initialAuthActionState);
  const [removeState, removeAction, removePending] = useActionState(removeEmailSendingDomainAction, initialAuthActionState);

  const [fromName, setFromName] = useState((emailBranding.fromName as string) ?? "");
  const [replyTo, setReplyTo] = useState((emailBranding.replyTo as string) ?? "");
  const [emailLogo, setEmailLogo] = useState((emailBranding.logoUrl as string) ?? "");
  const [localPart, setLocalPart] = useState((emailBranding.fromEmailLocalPart as string) ?? "noreply");
  const [testRecipient, setTestRecipient] = useState("");

  useEffect(() => {
    if (settingsState.status === "success") showToast(settingsState.message!, "success");
    else if (settingsState.status === "error") showToast(settingsState.message!, "error");
  }, [settingsState]);

  useEffect(() => {
    if (testState.status === "success") showToast(testState.message!, "success");
    else if (testState.status === "error") showToast(testState.message!, "error");
  }, [testState]);

  useEffect(() => {
    if (addDomainState.status === "success") {
      showToast(addDomainState.message!, "success");
      setShowAddDomain(false);
      setNewDomain("");
    } else if (addDomainState.status === "error") {
      showToast(addDomainState.message!, "error");
    }
  }, [addDomainState]);

  useEffect(() => {
    if (verifyState.status === "success") {
      showToast(verifyState.message!, "success");
    } else if (verifyState.status === "error") {
      showToast(verifyState.message!, "error");
    }
  }, [verifyState]);

  const verifiedDomain = domains.find((d) => d.status === "verified");
  const pendingDomains = domains.filter((d) => d.status === "pending" || d.status === "verifying");

  return (
    <div className="space-y-6">
      {/* ═══ SENDER IDENTITY ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-accent" />
            <h3 className="text-lg font-black">Sender Identity</h3>
          </div>
          <p className="text-sm text-muted-foreground">Configure how your organization appears in outgoing emails. Requires a verified sending domain.</p>
        </CardHeader>
        <CardContent>
          <form action={settingsAction} className="space-y-5">
            {activeConfig ? <input name="configId" type="hidden" value={activeConfig.id} /> : null}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="fromName">Email From Name</label>
                <input
                  className={selectClass}
                  id="fromName"
                  name="emailFromName"
                  placeholder="Apex Fitness"
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="replyTo">Reply-To Email</label>
                <input
                  className={selectClass}
                  id="replyTo"
                  name="emailReplyTo"
                  placeholder="replies@gym.com"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="emailLogo">Email Logo URL</label>
                <input
                  className={selectClass}
                  id="emailLogo"
                  name="emailLogoUrl"
                  placeholder="https://example.com/email-logo.png"
                  type="url"
                  value={emailLogo}
                  onChange={(e) => setEmailLogo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="localPart">Email Local Part</label>
                <div className="flex items-center gap-2">
                  <input
                    className={selectClass}
                    id="localPart"
                    name="fromEmailLocalPart"
                    placeholder="noreply"
                    type="text"
                    value={localPart}
                    onChange={(e) => setLocalPart(e.target.value)}
                  />
                  {verifiedDomain ? (
                    <span className="shrink-0 text-sm text-muted-foreground">@{verifiedDomain.domain}</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">The local part before @ in your from address (e.g., &quot;noreply&quot; becomes noreply@yourdomain.com)</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button disabled={settingsPending || !activeConfig} size="sm" type="submit" variant="primary">
                {settingsPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save Email Identity
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ═══ SENDING DOMAINS ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe2 className="size-5 text-accent" />
              <h3 className="text-lg font-black">Sending Domains</h3>
            </div>
            <Button onClick={() => setShowAddDomain(!showAddDomain)} size="sm" variant="primary">
              <Plus className="size-4" /> Add Domain
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Verified domains are used as the &quot;from&quot; address in outgoing emails. Add DNS records to verify ownership.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add domain form */}
          {showAddDomain ? (
            <form action={addDomainAction} className="rounded-md border border-border bg-surface-muted p-4">
              <div className="flex gap-3">
                <input
                  className={selectClass}
                  name="domain"
                  placeholder="mail.yourdomain.com"
                  required
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
                <Button disabled={addDomainPending} size="sm" type="submit" variant="primary">
                  {addDomainPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
                </Button>
                <Button onClick={() => { setShowAddDomain(false); setNewDomain(""); }} size="sm" variant="secondary" type="button">
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {/* Domain list */}
          {domains.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No email sending domains configured. Add one to get started.</p>
          ) : (
            <div className="space-y-3">
              {domains.map((domain) => {
                const isVerified = domain.status === "verified";
                const dnsRecords = domain.dns_records as Array<{ type: string; name: string; value: string; priority?: number; status: string }> | null;
                const metadata = domain.metadata as Record<string, string> | null;
                const resendDomainId = metadata?.resendDomainId ?? null;

                return (
                  <div key={domain.id} className="rounded-md border border-border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isVerified ? (
                          <CheckCircle2 className="size-5 text-green-500" />
                        ) : (
                          <XCircle className="size-5 text-amber-500" />
                        )}
                        <div>
                          <p className="text-sm font-bold">{domain.domain}</p>
                          <p className="text-xs text-muted-foreground">
                            {isVerified ? "Verified" : "Pending verification"}
                            {resendDomainId ? ` · Resend ID: ${resendDomainId.slice(0, 8)}...` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isVerified ? "success" : "warning"}>{isVerified ? "Verified" : "Pending"}</Badge>
                        {!isVerified && resendDomainId ? (
                          <form action={verifyAction}>
                            <input name="domainId" type="hidden" value={domain.id} />
                            <Button disabled={verifyPending} size="sm" variant="secondary" type="submit">
                              {verifyPending ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
                            </Button>
                          </form>
                        ) : null}
                        <form action={removeAction}>
                          <input name="domainId" type="hidden" value={domain.id} />
                          <Button disabled={removePending} size="sm" variant="destructive" type="submit">
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </div>

                    {/* DNS Records for pending domains */}
                    {!isVerified && dnsRecords && dnsRecords.length > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">DNS Records to Add</p>
                        {dnsRecords.map((record, i) => (
                          <div key={i} className="grid grid-cols-3 gap-2 rounded-md bg-surface-muted p-2 text-xs font-mono">
                            <div>
                              <span className="text-muted-foreground">Type: </span>
                              <span className="font-bold">{record.type}</span>
                            </div>
                            <div className="truncate">
                              <span className="text-muted-foreground">Name: </span>
                              <span className="font-bold">{record.name}</span>
                            </div>
                            <div className="truncate">
                              <span className="text-muted-foreground">Value: </span>
                              <span className="font-bold">{record.value}</span>
                              <button
                                className="ml-1 inline-flex text-muted-foreground hover:text-foreground"
                                onClick={() => { navigator.clipboard.writeText(record.value); showToast("Copied", "success"); }}
                                type="button"
                                aria-label="Copy value"
                              >
                                <Copy className="size-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ TEST EMAIL ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="size-5 text-accent" />
            <h3 className="text-lg font-black">Test Email</h3>
          </div>
          <p className="text-sm text-muted-foreground">Send a test email to verify your configuration works correctly.</p>
        </CardHeader>
        <CardContent>
          <form action={testAction} className="flex gap-3">
            <input
              className={selectClass}
              name="to"
              placeholder="your@email.com"
              required
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
            {verifiedDomain ? (
              <input name="from" type="hidden" value={fromName ? `${fromName} <${localPart}@${verifiedDomain.domain}>` : `${localPart}@${verifiedDomain.domain}`} />
            ) : null}
            {replyTo ? <input name="replyTo" type="hidden" value={replyTo} /> : null}
            <Button disabled={testPending} size="sm" type="submit" variant="primary">
              {testPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send Test
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
