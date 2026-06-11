import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import {
  buildTenantDomainDnsInstructions,
  buildTenantDomainTxtHost,
  buildTenantDomainTxtValue,
  defaultVercelARecord,
  defaultVercelCnameTarget,
  isSystemTenantDomain,
  matchesDnsValue,
  normalizeDnsValue,
  type TenantDomainDnsRecord
} from "@/features/enterprise/lib/domain-rules";
import { normalizeDomain } from "@/features/enterprise/lib/business-rules";
import type { TenantDomainRow, TenantDomainStatus, TenantDomainSslStatus } from "@/types/enterprise";
import type { Json } from "@/types/database";

type TenantDomainCheckStatus = "passed" | "failed" | "warning" | "skipped";
type TenantDomainOwnershipStatus = "passed" | "failed" | "skipped";
type TenantDomainTlsStatus = "passed" | "failed" | "pending" | "skipped";

export type TenantDomainCheckResult = {
  domainId: string;
  domain: string;
  normalizedDomain: string;
  nextStatus: TenantDomainStatus;
  nextSslStatus: TenantDomainSslStatus;
  checkStatus: TenantDomainCheckStatus;
  dnsStatus: TenantDomainCheckStatus;
  ownershipStatus: TenantDomainOwnershipStatus;
  tlsStatus: TenantDomainTlsStatus;
  expectedRecords: TenantDomainDnsRecord[];
  observedRecords: {
    a: string[];
    cname: string[];
    txt: string[];
    httpsStatus: number | null;
    errors: Record<string, string>;
  };
  providerResponse: Json;
  errorMessage: string | null;
};

const dnsTimeoutMs = 4_000;
const httpsTimeoutMs = 4_000;

export async function checkTenantDomain(domain: TenantDomainRow): Promise<TenantDomainCheckResult> {
  const normalizedDomain = normalizeDomain(domain.domain);
  if (!normalizedDomain) {
    return failedDomainResult(domain, "Domain is invalid after normalization.");
  }

  if (domain.status === "disabled") {
    return {
      domainId: domain.id,
      domain: domain.domain,
      normalizedDomain,
      nextStatus: "disabled",
      nextSslStatus: "not_applicable",
      checkStatus: "skipped",
      dnsStatus: "skipped",
      ownershipStatus: "skipped",
      tlsStatus: "skipped",
      expectedRecords: buildTenantDomainDnsInstructions(domain),
      observedRecords: { a: [], cname: [], txt: [], httpsStatus: null, errors: {} },
      providerResponse: { reason: "domain_disabled" },
      errorMessage: "Domain is disabled."
    };
  }

  const expectedRecords = buildTenantDomainDnsInstructions(domain, {
    aRecord: process.env.VERCEL_DNS_A_RECORD ?? defaultVercelARecord,
    cnameTarget: process.env.VERCEL_DNS_CNAME_TARGET ?? defaultVercelCnameTarget
  });
  const txtHost = buildTenantDomainTxtHost(normalizedDomain);

  const [aResult, cnameResult, txtResult, httpsResult] = await Promise.all([
    resolveWithTimeout(() => resolve4(normalizedDomain), [] as string[], "a"),
    resolveWithTimeout(() => resolveCname(normalizedDomain), [] as string[], "cname"),
    resolveWithTimeout(() => resolveTxt(txtHost), [] as string[][], "txt"),
    checkHttps(normalizedDomain)
  ]);

  const observedTxt = txtResult.value.flat().map((value) => value.trim());
  const errors = {
    ...aResult.error,
    ...cnameResult.error,
    ...txtResult.error,
    ...httpsResult.error
  };
  const expectedA = process.env.VERCEL_DNS_A_RECORD ?? defaultVercelARecord;
  const expectedCname = process.env.VERCEL_DNS_CNAME_TARGET ?? defaultVercelCnameTarget;
  const expectedTxt = buildTenantDomainTxtValue(domain.verification_token);
  const systemDomain = isSystemTenantDomain(domain);
  const hasRouting = systemDomain || aResult.value.includes(expectedA) || cnameResult.value.some((value) => matchesDnsValue(value, expectedCname));
  const hasOwnership = systemDomain || observedTxt.some((value) => value === expectedTxt);
  const hasHttps = systemDomain || Boolean(httpsResult.status && httpsResult.status >= 200 && httpsResult.status < 500);
  const dnsStatus: TenantDomainCheckStatus = hasRouting ? "passed" : "failed";
  const ownershipStatus: TenantDomainOwnershipStatus = hasOwnership ? "passed" : "failed";
  const tlsStatus: TenantDomainTlsStatus = hasHttps ? "passed" : hasRouting ? "pending" : "failed";
  const checkStatus: TenantDomainCheckStatus = dnsStatus === "passed" && ownershipStatus === "passed" ? "passed" : "failed";
  const nextStatus: TenantDomainStatus = checkStatus === "passed" ? "verified" : "failed";
  const nextSslStatus: TenantDomainSslStatus = tlsStatus === "passed" ? "managed_by_vercel" : tlsStatus === "pending" ? "pending" : "failed";
  const missing: string[] = [];

  if (!hasRouting) {
    missing.push(`Add either A ${expectedA} or CNAME ${normalizeDnsValue(expectedCname)}.`);
  }
  if (!hasOwnership) {
    missing.push(`Add TXT ${txtHost} = ${expectedTxt}.`);
  }
  if (checkStatus === "passed" && !hasHttps) {
    missing.push("DNS is correct; TLS is still pending.");
  }

  return {
    domainId: domain.id,
    domain: domain.domain,
    normalizedDomain,
    nextStatus,
    nextSslStatus,
    checkStatus,
    dnsStatus,
    ownershipStatus,
    tlsStatus,
    expectedRecords,
    observedRecords: {
      a: aResult.value,
      cname: cnameResult.value.map(normalizeDnsValue),
      txt: observedTxt,
      httpsStatus: httpsResult.status,
      errors
    },
    providerResponse: {
      provider: "vercel",
      routingMatched: hasRouting,
      ownershipMatched: hasOwnership,
      httpsReachable: hasHttps
    },
    errorMessage: missing.length > 0 ? missing.join(" ") : null
  };
}

function failedDomainResult(domain: TenantDomainRow, errorMessage: string): TenantDomainCheckResult {
  return {
    domainId: domain.id,
    domain: domain.domain,
    normalizedDomain: domain.normalized_domain ?? domain.domain,
    nextStatus: "failed",
    nextSslStatus: "failed",
    checkStatus: "failed",
    dnsStatus: "failed",
    ownershipStatus: "failed",
    tlsStatus: "failed",
    expectedRecords: [],
    observedRecords: { a: [], cname: [], txt: [], httpsStatus: null, errors: { domain: errorMessage } },
    providerResponse: { provider: "vercel" },
    errorMessage
  };
}

async function resolveWithTimeout<T>(resolver: () => Promise<T>, fallback: T, key: string): Promise<{ value: T; error: Record<string, string> }> {
  try {
    const value = await Promise.race([
      resolver(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error("DNS lookup timed out.")), dnsTimeoutMs);
      })
    ]);
    return { value, error: {} };
  } catch (error) {
    return {
      value: fallback,
      error: {
        [key]: error instanceof Error ? error.message : "DNS lookup failed."
      }
    };
  }
}

async function checkHttps(domain: string): Promise<{ status: number | null; error: Record<string, string> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), httpsTimeoutMs);

  try {
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal
    });
    return { status: response.status, error: {} };
  } catch (error) {
    return {
      status: null,
      error: {
        https: error instanceof Error ? error.message : "HTTPS check failed."
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}
