"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { CloudCog, Globe2, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { updateTenantDomainLifecycleAction } from "@/features/enterprise/actions/enterprise-actions";
import {
  buildTenantDomainDnsInstructions,
  domainStatusTone,
  isSystemTenantDomain,
  nextDomainActionLabel,
  type TenantDomainDnsRecord
} from "@/features/enterprise/lib/domain-rules";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type {
  TenantDomainLatestCheckRow,
  TenantDomainLatestProviderEventRow,
  TenantDomainProviderOperation,
  TenantDomainProviderStatus,
  TenantDomainRow,
  TenantDomainStatus
} from "@/types/enterprise";

type CheckResult = {
  status: TenantDomainRow["status"];
  sslStatus: TenantDomainRow["ssl_status"];
  checkedAt: string;
  errorMessage: string | null;
};

type ProviderResult = {
  operation: string;
  operationStatus: string;
  createdAt: string;
  errorMessage: string | null;
};

export function TenantDomainCenter({
  checks,
  domains,
  providerEvents
}: {
  domains: TenantDomainRow[];
  checks: TenantDomainLatestCheckRow[];
  providerEvents: TenantDomainLatestProviderEventRow[];
}) {
  const latestByDomain = useMemo(() => new Map(checks.map((check) => [check.tenant_domain_id, check])), [checks]);
  const latestProviderByDomain = useMemo(() => new Map(providerEvents.map((event) => [event.tenant_domain_id, event])), [providerEvents]);
  const [pendingCheckId, setPendingCheckId] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [providerResults, setProviderResults] = useState<Record<string, ProviderResult>>({});
  const [error, setError] = useState<string | null>(null);

  async function runCheck(domainId: string) {
    setPendingCheckId(domainId);
    setError(null);

    try {
      const response = await fetch("/api/enterprise/domains/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId })
      });
      const payload = await response.json() as {
        ok: boolean;
        data?: {
          domain: TenantDomainRow;
          check: TenantDomainLatestCheckRow;
          errorMessage: string | null;
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Domain check failed.");
      }

      const data = payload.data;
      setResults((current) => ({
        ...current,
        [domainId]: {
          status: data.domain.status,
          sslStatus: data.domain.ssl_status,
          checkedAt: data.check.checked_at ?? new Date().toISOString(),
          errorMessage: data.errorMessage
        }
      }));
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Domain check failed.");
    } finally {
      setPendingCheckId(null);
    }
  }

  async function runProvider(domainId: string, action: TenantDomainProviderOperation) {
    const pendingKey = `${domainId}:${action}`;
    setPendingProvider(pendingKey);
    setError(null);

    try {
      const response = await fetch("/api/enterprise/domains/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, action })
      });
      const payload = await response.json() as {
        ok: boolean;
        data?: {
          providerEvent?: {
            operation: string | null;
            operation_status: string | null;
            created_at: string | null;
            error_message: string | null;
          };
          operationStatus?: string;
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.data?.providerEvent) {
        throw new Error(payload.error?.message ?? "Vercel provider operation failed.");
      }

      setProviderResults((current) => ({
        ...current,
        [domainId]: {
          operation: payload.data?.providerEvent?.operation ?? action,
          operationStatus: payload.data?.providerEvent?.operation_status ?? payload.data?.operationStatus ?? "succeeded",
          createdAt: payload.data?.providerEvent?.created_at ?? new Date().toISOString(),
          errorMessage: payload.data?.providerEvent?.error_message ?? null
        }
      }));
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Vercel provider operation failed.");
    } finally {
      setPendingProvider(null);
    }
  }

  if (domains.length === 0) {
    return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No tenant domains have been registered yet.</div>;
  }

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {domains.map((domain) => {
        const latest = latestByDomain.get(domain.id);
        const latestProvider = latestProviderByDomain.get(domain.id);
        const result = results[domain.id];
        const providerResult = providerResults[domain.id];
        const status = result?.status ?? domain.status;
        const sslStatus = result?.sslStatus ?? domain.ssl_status;
        const records = buildTenantDomainDnsInstructions(domain);
        const checkedAt = result?.checkedAt ?? latest?.checked_at ?? domain.last_checked_at;
        const message = result?.errorMessage ?? latest?.error_message;
        const providerOperation = providerResult?.operation ?? latestProvider?.operation;
        const providerStatus = providerResult?.operationStatus ?? latestProvider?.operation_status;
        const providerAt = providerResult?.createdAt ?? latestProvider?.created_at;
        const providerMessage = providerResult?.errorMessage ?? latestProvider?.error_message;
        const systemDomain = isSystemTenantDomain(domain);

        return (
          <div className="rounded-md border border-border bg-surface-muted p-4" key={domain.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Globe2 className="size-4" />
                  <p className="font-black">{domain.domain}</p>
                  <DomainBadge status={status} sslStatus={sslStatus} />
                  <Badge variant="neutral">{formatEnterpriseLabel(domain.domain_type)}</Badge>
                  {domain.is_primary ? <Badge variant="premium">Primary</Badge> : null}
                </div>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">
                  {formatEnterpriseLabel(domain.routing_mode)} routing · TLS {formatEnterpriseLabel(sslStatus)}
                  {checkedAt ? ` · checked ${formatStableDateTime(checkedAt)}` : ""}
                </p>
                {providerOperation && providerStatus ? (
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    Vercel {formatEnterpriseLabel(providerOperation)} · <ProviderStatusBadge status={providerStatus} />
                    {providerAt ? ` · ${formatStableDateTime(providerAt)}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!systemDomain ? (
                  <>
                    <Button disabled={pendingProvider === `${domain.id}:add` || domain.status === "disabled"} onClick={() => void runProvider(domain.id, "add")} size="sm" variant="secondary">
                      {pendingProvider === `${domain.id}:add` ? <RefreshCw className="size-4 animate-spin" /> : <CloudCog className="size-4" />}
                      {pendingProvider === `${domain.id}:add` ? "Adding" : "Add to Vercel"}
                    </Button>
                    <Button disabled={pendingProvider === `${domain.id}:sync`} onClick={() => void runProvider(domain.id, "sync")} size="sm" variant="ghost">
                      {pendingProvider === `${domain.id}:sync` ? <RefreshCw className="size-4 animate-spin" /> : <CloudCog className="size-4" />}
                      Sync
                    </Button>
                    <Button disabled={pendingProvider === `${domain.id}:verify` || domain.status === "disabled"} onClick={() => void runProvider(domain.id, "verify")} size="sm" variant="ghost">
                      {pendingProvider === `${domain.id}:verify` ? <RefreshCw className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                      Verify
                    </Button>
                  </>
                ) : null}
                <Button disabled={pendingCheckId === domain.id || domain.status === "disabled"} onClick={() => void runCheck(domain.id)} size="sm" variant="secondary">
                  {pendingCheckId === domain.id ? <RefreshCw className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {pendingCheckId === domain.id ? "Checking" : nextDomainActionLabel(normalizeTenantDomainStatus(status), sslStatus)}
                </Button>
              </div>
            </div>

            <DomainLifecycleActions domain={domain} systemDomain={systemDomain} />

            {message ? <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">{message}</div> : null}
            {providerMessage ? <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs font-semibold leading-5 text-cyan-900">{providerMessage}</div> : null}

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              {records.map((record) => <DnsRecordView key={`${domain.id}-${record.type}-${record.host}-${record.value}`} record={record} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DnsRecordView({ record }: { record: TenantDomainDnsRecord }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={record.purpose === "ownership" ? "info" : "neutral"}>{record.type}</Badge>
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">{record.purpose}</span>
      </div>
      <div className="mt-3 space-y-2 text-xs font-semibold">
        <CodeLine label="Host" value={record.host} />
        <CodeLine label="Value" value={record.value} />
      </div>
    </div>
  );
}

function CodeLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <code className="mt-1 block overflow-x-auto rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white">{value}</code>
    </div>
  );
}

function DomainBadge({ sslStatus, status }: { status: TenantDomainRow["status"]; sslStatus: TenantDomainRow["ssl_status"] }) {
  const tone = domainStatusTone(normalizeTenantDomainStatus(status), sslStatus);
  const variant = tone === "good" ? "success" : tone === "watch" ? "warning" : tone === "risk" ? "error" : "neutral";
  return <Badge variant={variant}>{formatEnterpriseLabel(status)}</Badge>;
}

function normalizeTenantDomainStatus(status: TenantDomainRow["status"]): TenantDomainStatus {
  return status === "verified" || status === "failed" || status === "disabled" || status === "pending" ? status : "pending";
}

function DomainLifecycleActions({ domain, systemDomain }: { domain: TenantDomainRow; systemDomain: boolean }) {
  const [state, formAction] = useActionState(updateTenantDomainLifecycleAction, initialAuthActionState);
  const disabled = domain.status === "disabled";

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input name="tenantDomainId" type="hidden" value={domain.id} />
      <Button disabled={domain.is_primary || disabled} name="action" size="sm" type="submit" value="set_primary" variant="ghost">Set Primary</Button>
      {!systemDomain && !disabled ? <Button name="action" size="sm" type="submit" value="disable" variant="ghost">Disable</Button> : null}
      {!systemDomain && disabled ? <Button name="action" size="sm" type="submit" value="restore" variant="secondary">Restore</Button> : null}
      <FormMessage state={state} />
      <FieldError message={state.fieldErrors?.tenantDomainId?.[0] ?? state.fieldErrors?.action?.[0]} />
    </form>
  );
}

function ProviderStatusBadge({ status }: { status: string }) {
  const known = status as TenantDomainProviderStatus;
  const variant = known === "succeeded" ? "success" : known === "pending" ? "warning" : known === "failed" ? "error" : "neutral";
  return <Badge variant={variant}>{formatEnterpriseLabel(status)}</Badge>;
}

function formatStableDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
