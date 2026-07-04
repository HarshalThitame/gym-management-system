import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { buildEquipmentImagePrompt, generateEquipmentImagePreview, removeEquipmentImageAsset, persistGeneratedEquipmentImage } from "./equipment-image-service";
import type {
  EquipmentImageJobRow,
  EquipmentImageJobStatus,
  ErrorCategory,
  CreateEquipmentImageJobInput,
  CreateEquipmentImageJobResult,
  EquipmentImageJobStatusResult,
} from "../types/equipment-image-job-types";

const JOB_EXPIRY_HOURS = 24;
const PREVIEW_EXPIRY_HOURS = 2;
const MAX_RETRY_ATTEMPTS = 3;

export async function createEquipmentImageJob(input: CreateEquipmentImageJobInput): Promise<CreateEquipmentImageJobResult> {
  const client = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + JOB_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("equipment_image_generation_jobs")
    .insert({
      organization_id: input.organizationId,
      requested_by: input.requestedBy,
      equipment_name: input.equipmentName,
      equipment_type: input.equipmentType,
      brand: input.brand ?? null,
      model: input.model ?? null,
      custom_prompt: input.customPrompt ?? null,
      status: "queued",
      expires_at: expiresAt,
    })
    .select("id, status")
    .single();

  if (error) {
    throw new Error(`Failed to create image generation job: ${error.message}`);
  }

  await writeAuditLog({
    actorId: input.requestedBy,
    action: "organization_owner.equipment_image_job_created",
    entityType: "equipment_image_generation_job",
    entityId: data.id,
    metadata: {
      organizationId: input.organizationId,
      equipmentName: input.equipmentName,
      equipmentType: input.equipmentType,
    },
  });

  return { jobId: data.id, status: data.status as EquipmentImageJobStatus };
}

export async function getEquipmentImageJobStatus(
  jobId: string,
  organizationId: string,
): Promise<EquipmentImageJobStatusResult | null> {
  const client = createAdminClient();

  const { data, error } = await client
    .from("equipment_image_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as EquipmentImageJobRow;
  return {
    jobId: row.id,
    status: row.status,
    resolvedPrompt: row.resolved_prompt,
    previewDataUrl: row.status === "completed" ? row.preview_data_url : null,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    errorCategory: row.error_category,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function getActiveJobForUser(
  organizationId: string,
  requestedBy: string,
  equipmentName: string,
  equipmentType: string,
  brand: string | null,
  model: string | null,
  customPrompt: string | null,
): Promise<{ id: string; status: EquipmentImageJobStatus } | null> {
  const client = createAdminClient();

  const { data, error } = await client
    .from("equipment_image_generation_jobs")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("requested_by", requestedBy)
    .eq("equipment_name", equipmentName)
    .eq("equipment_type", equipmentType)
    .eq("brand", brand ?? null)
    .eq("model", model ?? null)
    .eq("custom_prompt", customPrompt ?? null)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return { id: data.id, status: data.status as EquipmentImageJobStatus };
}

const BACKOFF_MS = [1_000, 4_000, 10_000];

export async function processJob(jobId: string): Promise<void> {
  const client = createAdminClient();

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const { data: jobData, error: fetchError } = await client
      .from("equipment_image_generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (fetchError || !jobData) {
      console.error(`[JobProcessor] Job ${jobId} not found:`, fetchError?.message);
      return;
    }

    const job = jobData as unknown as EquipmentImageJobRow;

    if (job.status !== "queued") {
      return;
    }

    if (new Date(job.expires_at) <= new Date()) {
      await updateJobStatus(jobId, "expired", { last_error: "Job expired before processing." });
      await writeAuditLog({
        actorId: job.requested_by,
        action: "organization_owner.equipment_image_job_expired",
        entityType: "equipment_image_generation_job",
        entityId: jobId,
        metadata: { organizationId: job.organization_id },
      });
      return;
    }

    await updateJobStatus(jobId, "processing", { started_at: new Date().toISOString() });

    await writeAuditLog({
      actorId: job.requested_by,
      action: "organization_owner.equipment_image_job_processing",
      entityType: "equipment_image_generation_job",
      entityId: jobId,
      metadata: { organizationId: job.organization_id },
    });

    const prompt = buildEquipmentImagePrompt({
      name: job.equipment_name,
      equipmentType: job.equipment_type,
      brand: job.brand,
      model: job.model,
      customPrompt: job.custom_prompt,
    });

    const startTime = Date.now();

    try {
      const preview = await generateEquipmentImagePreview({
        organizationId: job.organization_id,
        name: job.equipment_name,
        equipmentType: job.equipment_type,
        brand: job.brand,
        model: job.model,
        customPrompt: job.custom_prompt,
      });

      const latencyMs = Date.now() - startTime;
      const previewExpiry = new Date(Date.now() + PREVIEW_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

      await updateJobStatus(jobId, "completed", {
        resolved_prompt: prompt,
        preview_data_url: preview.dataUrl,
        provider_latency_ms: latencyMs,
        completed_at: new Date().toISOString(),
        expires_at: previewExpiry,
        attempt_count: attempt + 1,
      });

      await writeAuditLog({
        actorId: job.requested_by,
        action: "organization_owner.equipment_image_job_completed",
        entityType: "equipment_image_generation_job",
        entityId: jobId,
        metadata: {
          organizationId: job.organization_id,
          latencyMs,
          providerModel: preview.model,
        },
      });

      return;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Unknown error";
      let errorCategory: ErrorCategory = "unknown";

      if (message.includes("API key") || message.includes("401") || message.includes("403")) {
        errorCategory = "auth";
      } else if (message.includes("rate limit") || message.includes("429")) {
        errorCategory = "rate_limit";
      } else if (message.includes("timed out") || message.includes("Timeout") || message.includes("Abort")) {
        errorCategory = "timeout";
      } else if (message.includes("prompt")) {
        errorCategory = "invalid_prompt";
      }

      const isTerminal = errorCategory === "auth" || errorCategory === "invalid_prompt";
      const isLastAttempt = attempt + 1 >= MAX_RETRY_ATTEMPTS;
      const willRetry = !isTerminal && !isLastAttempt;

      await updateJobStatus(jobId, willRetry ? "queued" : "failed", {
        last_error: message,
        error_category: errorCategory,
        attempt_count: attempt + 1,
        provider_latency_ms: latencyMs,
        completed_at: willRetry ? null : new Date().toISOString(),
      });

      await writeAuditLog({
        actorId: job.requested_by,
        action: isTerminal || isLastAttempt
          ? "organization_owner.equipment_image_job_failed"
          : "organization_owner.equipment_image_job_retrying",
        entityType: "equipment_image_generation_job",
        entityId: jobId,
        metadata: {
          organizationId: job.organization_id,
          errorCategory,
          errorMessage: message,
          attemptCount: attempt + 1,
          willRetry,
        },
      });

      if (!willRetry) return;

      const delay = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function retryEquipmentImageJob(
  jobId: string,
  organizationId: string,
  requestedBy: string,
): Promise<CreateEquipmentImageJobResult> {
  const client = createAdminClient();

  const { data, error } = await client
    .from("equipment_image_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Job not found.");
  }

  const job = data as unknown as EquipmentImageJobRow;

  if (job.status !== "failed" && job.status !== "expired") {
    throw new Error(`Cannot retry job in "${job.status}" status.`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + JOB_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  await updateJobStatus(jobId, "queued", {
    last_error: null,
    error_category: null,
    preview_data_url: null,
    preview_storage_path: null,
    provider_latency_ms: null,
    started_at: null,
    completed_at: null,
    expires_at: expiresAt,
  });

  await writeAuditLog({
    actorId: requestedBy,
    action: "organization_owner.equipment_image_job_retried",
    entityType: "equipment_image_generation_job",
    entityId: jobId,
    metadata: { organizationId, previousError: job.last_error },
  });

  return { jobId, status: "queued" };
}

export async function acceptEquipmentImageJob(
  jobId: string,
  organizationId: string,
  requestedBy: string,
): Promise<{ imageUrl: string; imageStoragePath: string; imagePrompt: string | null }> {
  const client = createAdminClient();

  const { data, error } = await client
    .from("equipment_image_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Job not found.");
  }

  const job = data as unknown as EquipmentImageJobRow;

  if (job.status !== "completed") {
    throw new Error(`Cannot accept image from job with status "${job.status}". Only completed jobs can be accepted.`);
  }

  if (!job.preview_data_url) {
    throw new Error("Job has no preview data to accept.");
  }

  const asset = await persistGeneratedEquipmentImage({
    organizationId,
    dataUrl: job.preview_data_url,
    prompt: job.resolved_prompt ?? job.equipment_name,
  });

  await updateJobStatus(jobId, "completed", {
    preview_data_url: null,
    preview_storage_path: null,
  });

  await writeAuditLog({
    actorId: requestedBy,
    action: "organization_owner.equipment_image_preview_accepted",
    entityType: "equipment_image_generation_job",
    entityId: jobId,
    metadata: {
      organizationId,
      storagePath: asset.imageStoragePath,
      imageUrl: asset.imageUrl,
    },
  });

  return {
    imageUrl: asset.imageUrl,
    imageStoragePath: asset.imageStoragePath,
    imagePrompt: job.resolved_prompt ?? null,
  };
}

export async function cancelEquipmentImageJob(
  jobId: string,
  organizationId: string,
  requestedBy: string,
): Promise<void> {
  const client = createAdminClient();

  const { data, error } = await client
    .from("equipment_image_generation_jobs")
    .select("status")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Job not found.");
  }

  if (data.status !== "queued") {
    throw new Error("Only queued jobs can be cancelled.");
  }

  await updateJobStatus(jobId, "cancelled");

  await writeAuditLog({
    actorId: requestedBy,
    action: "organization_owner.equipment_image_job_cancelled",
    entityType: "equipment_image_generation_job",
    entityId: jobId,
    metadata: { organizationId },
  });
}

export async function cleanupExpiredJobs(): Promise<{ expired: number; cleaned: number }> {
  const client = createAdminClient();
  let expired = 0;
  let cleaned = 0;

  const { data: expiredJobs, error: fetchError } = await client
    .from("equipment_image_generation_jobs")
    .select("id, organization_id, preview_storage_path, requested_by, status")
    .lt("expires_at", new Date().toISOString())
    .in("status", ["queued", "processing", "completed"]);

  if (fetchError || !expiredJobs) {
    console.error("[Cleanup] Failed to fetch expired jobs:", fetchError?.message);
    return { expired, cleaned };
  }

  for (const job of expiredJobs) {
    if (job.status === "completed") {
      if (job.preview_storage_path) {
        await removeEquipmentImageAsset(job.preview_storage_path).catch(() => {});
      }
    }

    const { error: updateError } = await client
      .from("equipment_image_generation_jobs")
      .update({
        status: "expired",
        preview_data_url: null,
        preview_storage_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (!updateError) {
      expired++;

      await writeAuditLog({
        actorId: job.requested_by,
        action: "organization_owner.equipment_image_job_expired",
        entityType: "equipment_image_generation_job",
        entityId: job.id,
        metadata: { organizationId: job.organization_id, previousStatus: job.status },
      });
    }
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: oldJobs, error: deleteError } = await client
    .from("equipment_image_generation_jobs")
    .select("id")
    .lt("created_at", twentyFourHoursAgo)
    .in("status", ["expired", "cancelled", "failed"]);

  if (!deleteError && oldJobs) {
    const ids = oldJobs.map((j) => j.id);
    if (ids.length > 0) {
      const { error: delError } = await client
        .from("equipment_image_generation_jobs")
        .delete()
        .in("id", ids);

      if (!delError) {
        cleaned = ids.length;
      }
    }
  }

  return { expired, cleaned };
}

async function updateJobStatus(
  jobId: string,
  status: EquipmentImageJobStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const client = createAdminClient();
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };

  const { error } = await client
    .from("equipment_image_generation_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) {
    console.error(`[JobService] Failed to update job ${jobId}:`, error.message);
  }
}
