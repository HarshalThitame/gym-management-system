"use server";

/**
 * Centralized entitlement audit logging service.
 *
 * Wraps writeAuditLog from lib/audit.ts with:
 * - Typed event constants from audit-events.ts
 * - Safe error handling (never throws, never blocks caller)
 * - Redaction of sensitive fields
 * - Structured metadata
 */

import { writeAuditLog } from "@/lib/audit";
import { AUDIT } from "./audit-events";
import type { AuditEventType } from "./audit-events";

type AuditMetadata = Record<string, unknown>;

async function safeLog(input: {
  actorId: string | null;
  action: AuditEventType;
  entityType: string;
  entityId: string | null;
  metadata?: AuditMetadata;
}): Promise<void> {
  try {
    await writeAuditLog({
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: sanitizeMetadata(input.metadata ?? {}) as never,
    });
  } catch {
    // Audit logging must never crash the caller.
    // Log to server console for observability.
    console.warn("[entitlement-audit] Failed to write audit log", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}

/** Removes sensitive fields that should never appear in audit logs */
function sanitizeMetadata(meta: AuditMetadata): AuditMetadata {
  const safe = { ...meta };
  const sensitiveKeys = ["password", "token", "secret", "key", "signature", "rawBody", "card", "cvv", "pan"];
  for (const key of Object.keys(safe)) {
    for (const sensitive of sensitiveKeys) {
      if (key.toLowerCase().includes(sensitive)) {
        safe[key] = "[REDACTED]";
      }
    }
  }
  return safe;
}

// ─── Feature access logging ────────────────────────────────────────────────

export async function logFeatureAccessDenied(params: {
  actorId: string | null;
  organizationId: string;
  featureKey: string;
  reason: string;
  actionName?: string;
}) {
  await safeLog({
    actorId: params.actorId,
    action: AUDIT.FEATURE_ACCESS_DENIED,
    entityType: "organization",
    entityId: params.organizationId,
    metadata: {
      featureKey: params.featureKey,
      reason: params.reason,
      actionName: params.actionName ?? "unknown",
    },
  });
}

export async function logRouteAccessDenied(params: {
  actorId: string | null;
  organizationId: string;
  route: string;
  featureKey: string;
  reason: string;
}) {
  await safeLog({
    actorId: params.actorId,
    action: AUDIT.ROUTE_ACCESS_DENIED,
    entityType: "organization",
    entityId: params.organizationId,
    metadata: { route: params.route, featureKey: params.featureKey, reason: params.reason },
  });
}

// ─── Limit logging ──────────────────────────────────────────────────────────

export async function logLimitReached(params: {
  actorId: string | null;
  organizationId: string;
  limitKey: string;
  currentUsage: number;
  limitValue: number;
  attemptedIncrement: number;
}) {
  await safeLog({
    actorId: params.actorId,
    action: AUDIT.LIMIT_REACHED_DENIED,
    entityType: "organization",
    entityId: params.organizationId,
    metadata: {
      limitKey: params.limitKey,
      currentUsage: params.currentUsage,
      limitValue: params.limitValue,
      attemptedIncrement: params.attemptedIncrement,
    },
  });
}

// ─── Subscription lifecycle logging ─────────────────────────────────────────

export async function logSubscriptionActivated(params: {
  actorId: string | null;
  organizationId: string;
  subscriptionId: string;
  packageId: string;
  packageName: string;
  intentType: string;
}) {
  await safeLog({
    actorId: params.actorId,
    action: AUDIT.SUBSCRIPTION_ACTIVATED,
    entityType: "organization_subscription",
    entityId: params.subscriptionId,
    metadata: {
      organizationId: params.organizationId,
      packageId: params.packageId,
      packageName: params.packageName,
      intentType: params.intentType,
    },
  });
}

export async function logSubscriptionCancelled(params: {
  actorId: string | null;
  organizationId: string;
  subscriptionId: string;
  reason: string;
}) {
  await safeLog({
    actorId: params.actorId,
    action: AUDIT.SUBSCRIPTION_CANCELLED,
    entityType: "organization_subscription",
    entityId: params.subscriptionId,
    metadata: { organizationId: params.organizationId, reason: params.reason },
  });
}

// ─── Security event logging ─────────────────────────────────────────────────

export async function logSecurityEvent(params: {
  actorId: string | null;
  organizationId: string;
  eventType: "CROSS_TENANT" | "PRICE_TAMPERING" | "AMOUNT_MISMATCH" | "PACKAGE_TAMPERING" | "DUPLICATE_SUBSCRIPTION";
  detail?: string;
}) {
  const actionMap = {
    CROSS_TENANT: AUDIT.CROSS_TENANT_ACCESS_DENIED,
    PRICE_TAMPERING: AUDIT.PRICE_TAMPERING_DETECTED,
    AMOUNT_MISMATCH: AUDIT.AMOUNT_MISMATCH_DETECTED,
    PACKAGE_TAMPERING: AUDIT.PACKAGE_TAMPERING_DETECTED,
    DUPLICATE_SUBSCRIPTION: AUDIT.DUPLICATE_SUBSCRIPTION_DETECTED,
  };
  await safeLog({
    actorId: params.actorId,
    action: actionMap[params.eventType],
    entityType: "organization",
    entityId: params.organizationId,
    metadata: { eventType: params.eventType, detail: params.detail ?? null },
  });
}

// ─── Webhook event logging (bridges domain tables → audit_logs) ────────────

export async function logWebhookEvent(params: {
  actorId: null;
  organizationId: string | null;
  eventType: "WEBHOOK_CAPTURED" | "WEBHOOK_FAILED" | "WEBHOOK_DUPLICATE" | "WEBHOOK_SIGNATURE_INVALID";
  providerOrderId: string;
  providerPaymentId?: string;
  detail?: string;
}) {
  const actionMap = {
    WEBHOOK_CAPTURED: AUDIT.WEBHOOK_PAYMENT_CAPTURED,
    WEBHOOK_FAILED: AUDIT.WEBHOOK_PAYMENT_FAILED,
    WEBHOOK_DUPLICATE: AUDIT.WEBHOOK_DUPLICATE_IGNORED,
    WEBHOOK_SIGNATURE_INVALID: AUDIT.WEBHOOK_SIGNATURE_INVALID,
  };
  await safeLog({
    actorId: null,
    action: actionMap[params.eventType],
    entityType: "payment_provider_event",
    entityId: null,
    metadata: {
      organizationId: params.organizationId,
      providerOrderId: params.providerOrderId,
      providerPaymentId: params.providerPaymentId ?? null,
      detail: params.detail ?? null,
    },
  });
}
