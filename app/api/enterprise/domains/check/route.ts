import { NextResponse } from "next/server";
import { z } from "zod";
import { isSystemTenantDomain } from "@/features/enterprise/lib/domain-rules";
import { checkTenantDomain } from "@/features/enterprise/services/tenant-domain-check-service";
import { writeAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiFeatureAccess } from "@/features/entitlement";
import { notifyDomainCheck } from "../sse";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

const DomainCheckSchema = z.object({
  domainId: z.string().uuid()
});

export async function POST(request: Request) {
  const auth = await requireApiRole(["super_admin", "organization_owner", "gym_admin"], {
    unauthenticatedMessage: "Sign in as an admin to verify domains.",
    forbiddenMessage: "Only admins can verify tenant domains."
  });

  if (!auth.ok) {
    return auth.response;
  }

  const rateLimit = await checkRateLimit(`tenant-domain-check:${auth.context.userId}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many domain checks. Please wait a minute." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = DomainCheckSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Domain check payload is invalid.",
          fieldErrors: parsed.error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: domain, error: domainError } = await supabase.from("tenant_domains").select("*").eq("id", parsed.data.domainId).maybeSingle();

  if (domainError) {
    return NextResponse.json({ ok: false, error: { code: "DOMAIN_LOOKUP_FAILED", message: domainError.message } }, { status: 500 });
  }

  if (!domain) {
    return NextResponse.json({ ok: false, error: { code: "DOMAIN_NOT_FOUND", message: "Domain was not found or is not accessible." } }, { status: 404 });
  }

  if (!isSystemTenantDomain(domain)) {
    const featureResponse = await requireCustomDomainFeature(domain.organization_id);
    if (featureResponse) {
      return featureResponse;
    }
  }

  const result = await checkTenantDomain(domain);
  const checkedAt = new Date().toISOString();
  const metadata = mergeMetadata(domain.metadata, {
    last_check: {
      provider: "vercel",
      checked_at: checkedAt,
      check_status: result.checkStatus,
      dns_status: result.dnsStatus,
      ownership_status: result.ownershipStatus,
      tls_status: result.tlsStatus,
      error_message: result.errorMessage
    }
  });

  const { data: updatedDomain, error: updateError } = await supabase
    .from("tenant_domains")
    .update({
      status: result.nextStatus,
      ssl_status: result.nextSslStatus,
      verified_at: result.nextStatus === "verified" ? domain.verified_at ?? checkedAt : domain.verified_at,
      last_checked_at: checkedAt,
      metadata
    })
    .eq("id", domain.id)
    .select("*")
    .maybeSingle();

  if (updateError || !updatedDomain) {
    return NextResponse.json({ ok: false, error: { code: "DOMAIN_UPDATE_FAILED", message: updateError?.message ?? "Domain status could not be updated." } }, { status: 500 });
  }

  const { data: checkRow, error: checkError } = await supabase
    .from("tenant_domain_checks")
    .insert({
      tenant_domain_id: domain.id,
      organization_id: domain.organization_id,
      branch_id: domain.branch_id,
      gym_id: domain.gym_id,
      domain: domain.domain,
      provider: "vercel",
      check_status: result.checkStatus,
      dns_status: result.dnsStatus,
      ownership_status: result.ownershipStatus,
      tls_status: result.tlsStatus,
      expected_records: result.expectedRecords as unknown as Json,
      observed_records: result.observedRecords as unknown as Json,
      provider_response: result.providerResponse,
      error_message: result.errorMessage,
      checked_by: auth.context.userId,
      checked_at: checkedAt
    })
    .select("*")
    .maybeSingle();

  if (checkError || !checkRow) {
    return NextResponse.json({ ok: false, error: { code: "DOMAIN_CHECK_SAVE_FAILED", message: checkError?.message ?? "Domain check could not be saved." } }, { status: 500 });
  }

  if (domain.tenant_config_id && result.nextStatus === "verified") {
    await supabase.from("tenant_configs").update({ domain_status: "verified", updated_by: auth.context.userId }).eq("id", domain.tenant_config_id);
  }

  await writeAuditLog({
    actorId: auth.context.userId,
    gymId: domain.gym_id,
    action: "tenant_domain.checked",
    entityType: "tenant_domain",
    entityId: domain.id,
    metadata: {
      domain: domain.domain,
      checkStatus: result.checkStatus,
      dnsStatus: result.dnsStatus,
      ownershipStatus: result.ownershipStatus,
      tlsStatus: result.tlsStatus
    }
  });

  notifyDomainCheck(domain.id, {
    status: updatedDomain.status,
    ssl_status: updatedDomain.ssl_status,
    checked_at: checkedAt,
    errorMessage: result.errorMessage,
  });

  return NextResponse.json({
    ok: true,
    data: {
      domain: updatedDomain,
      check: checkRow,
      expectedRecords: result.expectedRecords,
      observedRecords: result.observedRecords,
      errorMessage: result.errorMessage
    }
  });
}

async function requireCustomDomainFeature(organizationId: string | null) {
  if (!organizationId) {
    return NextResponse.json({ error: "FEATURE_LOCKED", reason: "UNAUTHORIZED_ORG_ACCESS", message: "Organization scope required.", featureKey: "custom_domain" }, { status: 403 });
  }
  return requireApiFeatureAccess(organizationId, "custom_domain");
}

function mergeMetadata(current: Json, patch: Record<string, Json>): Json {
  const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  return { ...base, ...patch };
}
