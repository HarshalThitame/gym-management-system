import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addVercelProjectDomain,
  getVercelDomainProviderConfig,
  getVercelProviderReadinessMessage,
  removeVercelProjectDomain,
  syncVercelProjectDomain,
  VercelDomainProviderError,
  verifyVercelProjectDomain,
  type VercelDomainProviderAction,
  type VercelDomainProviderResult
} from "@/features/enterprise/services/vercel-domain-provider";
import { isSystemTenantDomain } from "@/features/enterprise/lib/domain-rules";
import { normalizeDomain } from "@/features/enterprise/lib/business-rules";
import { writeAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiFeatureAccess } from "@/features/entitlement";
import type { Database, Json } from "@/types/database";
import type { TenantDomainProviderStatus, TenantDomainRow } from "@/types/enterprise";

export const runtime = "nodejs";

const DomainProvisionSchema = z.object({
  domainId: z.string().uuid(),
  action: z.enum(["add", "sync", "verify", "remove"])
});

type ProviderEventInsert = Database["public"]["Tables"]["tenant_domain_provider_events"]["Insert"];

export async function POST(request: Request) {
  const auth = await requireApiRole(["super_admin", "organization_owner", "gym_admin"], {
    unauthenticatedMessage: "Sign in as an admin to manage provider domains.",
    forbiddenMessage: "Only admins can manage provider domain automation."
  });

  if (!auth.ok) {
    return auth.response;
  }

  const rateLimit = await checkRateLimit(`tenant-domain-provision:${auth.context.userId}`, 12, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many provider domain operations. Please wait a minute." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = DomainProvisionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Domain provider payload is invalid.",
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

  const normalizedDomain = normalizeDomain(domain.domain);
  if (!normalizedDomain) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_DOMAIN", message: "Domain is invalid after normalization." } }, { status: 400 });
  }

  if (isSystemTenantDomain(domain)) {
    return NextResponse.json({ ok: false, error: { code: "SYSTEM_DOMAIN", message: "System domains are managed by the platform deployment and do not need provider automation." } }, { status: 400 });
  }

  const featureResponse = await requireCustomDomainFeature(domain.organization_id);
  if (featureResponse) {
    return featureResponse;
  }

  if (domain.status === "disabled" && parsed.data.action !== "sync") {
    return NextResponse.json({ ok: false, error: { code: "DOMAIN_DISABLED", message: "Disabled domains can only be synced for audit visibility." } }, { status: 400 });
  }

  const providerConfig = getVercelDomainProviderConfig();
  if (!providerConfig.configured) {
    const event = await insertProviderEvent(supabase, domain, parsed.data.action, "skipped", {
      request: { domain: normalizedDomain, action: parsed.data.action, missing: providerConfig.missing },
      response: { configured: false, missing: providerConfig.missing },
      errorMessage: getVercelProviderReadinessMessage(providerConfig),
      userId: auth.context.userId,
      projectId: providerConfig.projectIdOrName,
      teamId: providerConfig.teamId
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PROVIDER_NOT_CONFIGURED",
          message: getVercelProviderReadinessMessage(providerConfig),
          missing: providerConfig.missing
        },
        data: { providerEvent: event.data ?? null }
      },
      { status: 503 }
    );
  }

  try {
    const providerResult = await runProviderAction(parsed.data.action, normalizedDomain);
    const operationStatus = deriveOperationStatus(parsed.data.action, providerResult);
    const eventResult = await insertProviderEvent(supabase, domain, parsed.data.action, operationStatus, {
      request: { domain: normalizedDomain, action: parsed.data.action },
      response: providerResult as unknown as Json,
      errorMessage: operationStatus === "failed" ? "Provider operation did not complete." : null,
      userId: auth.context.userId,
      projectId: providerResult.projectIdOrName,
      teamId: providerResult.teamId
    });

    if (eventResult.error || !eventResult.data) {
      return NextResponse.json({ ok: false, error: { code: "PROVIDER_EVENT_SAVE_FAILED", message: eventResult.error?.message ?? "Provider event could not be saved." } }, { status: 500 });
    }

    const updatedDomainResult = await updateDomainProviderMetadata(supabase, domain, providerResult, operationStatus, auth.context.userId);
    if (updatedDomainResult.error || !updatedDomainResult.data) {
      return NextResponse.json({ ok: false, error: { code: "DOMAIN_PROVIDER_UPDATE_FAILED", message: updatedDomainResult.error?.message ?? "Domain provider metadata could not be updated." } }, { status: 500 });
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: domain.gym_id,
      action: `tenant_domain.provider_${parsed.data.action}`,
      entityType: "tenant_domain",
      entityId: domain.id,
      metadata: {
        domain: domain.domain,
        operationStatus,
        provider: "vercel"
      }
    });

    return NextResponse.json({
      ok: true,
      data: {
        domain: updatedDomainResult.data,
        providerEvent: eventResult.data,
        providerResult,
        operationStatus
      }
    });
  } catch (error) {
    const providerError = normalizeProviderError(error);
    const event = await insertProviderEvent(supabase, domain, parsed.data.action, "failed", {
      request: { domain: normalizedDomain, action: parsed.data.action },
      response: providerError.response ?? {},
      errorMessage: providerError.message,
      userId: auth.context.userId,
      projectId: providerConfig.projectIdOrName,
      teamId: providerConfig.teamId
    });

    await updateDomainProviderFailure(supabase, domain, parsed.data.action, providerError, auth.context.userId);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: providerError.code ?? "PROVIDER_OPERATION_FAILED",
          message: providerError.message
        },
        data: { providerEvent: event.data ?? null }
      },
      { status: providerError.status >= 400 && providerError.status < 600 ? providerError.status : 502 }
    );
  }
}

async function requireCustomDomainFeature(organizationId: string | null) {
  if (!organizationId) {
    return NextResponse.json({ error: "FEATURE_LOCKED", reason: "UNAUTHORIZED_ORG_ACCESS", message: "Organization scope required.", featureKey: "custom_domain" }, { status: 403 });
  }
  return requireApiFeatureAccess(organizationId, "custom_domain");
}

async function runProviderAction(action: VercelDomainProviderAction, domain: string) {
  if (action === "add") {
    return addVercelProjectDomain(domain);
  }

  if (action === "verify") {
    return verifyVercelProjectDomain(domain);
  }

  if (action === "remove") {
    return removeVercelProjectDomain(domain);
  }

  return syncVercelProjectDomain(domain);
}

function deriveOperationStatus(action: VercelDomainProviderAction, result: VercelDomainProviderResult): TenantDomainProviderStatus {
  if (action === "remove") {
    return "succeeded";
  }

  const verified = readBoolean(result.projectDomain, "verified");
  const misconfigured = readBoolean(result.domainConfiguration, "misconfigured");

  if (misconfigured === true || verified === false) {
    return "pending";
  }

  return "succeeded";
}

async function insertProviderEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  domain: TenantDomainRow,
  operation: VercelDomainProviderAction,
  operationStatus: TenantDomainProviderStatus,
  options: {
    request: Json;
    response: Json;
    errorMessage: string | null;
    userId: string;
    projectId: string | null;
    teamId: string | null;
  }
) {
  const payload: ProviderEventInsert = {
    tenant_domain_id: domain.id,
    organization_id: domain.organization_id,
    branch_id: domain.branch_id,
    gym_id: domain.gym_id,
    domain: domain.domain,
    provider: "vercel",
    operation,
    operation_status: operationStatus,
    provider_project_id: options.projectId,
    provider_team_id: options.teamId,
    request_payload: options.request,
    response_payload: options.response,
    error_message: options.errorMessage,
    requested_by: options.userId
  };

  return supabase.from("tenant_domain_provider_events").insert(payload).select("*").maybeSingle();
}

function updateDomainProviderMetadata(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  domain: TenantDomainRow,
  providerResult: VercelDomainProviderResult,
  operationStatus: TenantDomainProviderStatus,
  userId: string
) {
  const metadata = mergeProviderMetadata(domain.metadata, {
    last_action: providerResult.action,
    last_status: operationStatus,
    last_synced_at: new Date().toISOString(),
    project_id_or_name: providerResult.projectIdOrName,
    team_id: providerResult.teamId,
    project_domain: providerResult.projectDomain,
    domain_configuration: providerResult.domainConfiguration
  });
  const update = providerResult.action === "remove"
    ? {
        status: "disabled" as const,
        is_primary: false,
        metadata,
        created_by: domain.created_by,
        updated_at: new Date().toISOString()
      }
    : {
        metadata,
        created_by: domain.created_by ?? userId,
        updated_at: new Date().toISOString()
      };

  return supabase.from("tenant_domains").update(update).eq("id", domain.id).select("*").maybeSingle();
}

function updateDomainProviderFailure(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  domain: TenantDomainRow,
  action: VercelDomainProviderAction,
  error: VercelDomainProviderError,
  userId: string
) {
  const metadata = mergeProviderMetadata(domain.metadata, {
    last_action: action,
    last_status: "failed",
    last_synced_at: new Date().toISOString(),
    error: {
      code: error.code,
      message: error.message,
      status: error.status
    }
  });

  return supabase.from("tenant_domains").update({ metadata, created_by: domain.created_by ?? userId }).eq("id", domain.id);
}

function mergeProviderMetadata(current: Json, providerPatch: Json): Json {
  const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  const provider = "provider" in base && base.provider && typeof base.provider === "object" && !Array.isArray(base.provider) ? base.provider : {};
  return {
    ...base,
    provider: {
      ...provider,
      vercel: providerPatch
    }
  };
}

function normalizeProviderError(error: unknown): VercelDomainProviderError {
  if (error instanceof VercelDomainProviderError) {
    return error;
  }

  return new VercelDomainProviderError(error instanceof Error ? error.message : "Vercel provider operation failed.", 502, "PROVIDER_OPERATION_FAILED", null);
}

function readBoolean(value: Json | null, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !(key in value)) {
    return null;
  }

  return typeof value[key] === "boolean" ? value[key] : null;
}
