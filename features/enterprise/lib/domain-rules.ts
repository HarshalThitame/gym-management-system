import type { TenantDomainRow, TenantDomainStatus, TenantDomainSslStatus } from "@/types/enterprise";
import { normalizeDomain } from "./business-rules";

export const defaultVercelARecord = "76.76.21.21";
export const defaultVercelCnameTarget = "cname.vercel-dns.com";

export type TenantDomainDnsRecord = {
  type: "A" | "CNAME" | "TXT";
  host: string;
  value: string;
  purpose: "routing" | "ownership";
  required: boolean;
};

export type TenantDomainCheckTone = "good" | "watch" | "risk" | "neutral";

type DomainInstructionOptions = {
  aRecord?: string;
  cnameTarget?: string;
};

export function buildTenantDomainDnsInstructions(domain: Pick<TenantDomainRow, "domain" | "domain_type" | "verification_token">, options: DomainInstructionOptions = {}): TenantDomainDnsRecord[] {
  const normalizedDomain = normalizeDomain(domain.domain) ?? domain.domain;
  const aRecord = options.aRecord ?? defaultVercelARecord;
  const cnameTarget = normalizeDnsValue(options.cnameTarget ?? defaultVercelCnameTarget);

  const records: TenantDomainDnsRecord[] = [
    {
      type: "A",
      host: normalizedDomain,
      value: aRecord,
      purpose: "routing",
      required: false
    },
    {
      type: "CNAME",
      host: normalizedDomain,
      value: cnameTarget,
      purpose: "routing",
      required: false
    }
  ];

  if (!isSystemTenantDomain(domain)) {
    records.push({
      type: "TXT",
      host: buildTenantDomainTxtHost(normalizedDomain),
      value: buildTenantDomainTxtValue(domain.verification_token),
      purpose: "ownership",
      required: true
    });
  }

  return records;
}

export function buildTenantDomainTxtHost(domain: string) {
  return `_apex-tenant-verification.${normalizeDomain(domain) ?? domain}`;
}

export function buildTenantDomainTxtValue(token: string) {
  return `apex-tenant=${token}`;
}

export function normalizeDnsValue(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function matchesDnsValue(value: string, expected: string) {
  return normalizeDnsValue(value) === normalizeDnsValue(expected);
}

export function domainStatusTone(status: TenantDomainStatus, sslStatus?: TenantDomainSslStatus | null): TenantDomainCheckTone {
  if (status === "verified" && (!sslStatus || sslStatus === "managed_by_vercel" || sslStatus === "issued")) {
    return "good";
  }

  if (status === "pending" || sslStatus === "pending") {
    return "watch";
  }

  if (status === "failed" || sslStatus === "failed") {
    return "risk";
  }

  return "neutral";
}

export function isSystemTenantDomain(domain: Pick<TenantDomainRow, "domain_type" | "domain">) {
  return domain.domain_type === "system" || normalizeDnsValue(domain.domain).endsWith(".vercel.app");
}

export function nextDomainActionLabel(status: TenantDomainStatus, sslStatus: TenantDomainSslStatus) {
  if (status === "verified" && (sslStatus === "managed_by_vercel" || sslStatus === "issued")) {
    return "Ready";
  }

  if (status === "verified") {
    return "TLS pending";
  }

  if (status === "disabled") {
    return "Disabled";
  }

  if (status === "failed") {
    return "Fix DNS";
  }

  return "Verify DNS";
}
