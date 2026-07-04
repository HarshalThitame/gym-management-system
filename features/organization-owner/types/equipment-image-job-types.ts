export type EquipmentImageJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

export type ErrorCategory =
  | "auth"
  | "rate_limit"
  | "timeout"
  | "provider_unavailable"
  | "invalid_prompt"
  | "unknown";

export type EquipmentImageJobRow = {
  id: string;
  organization_id: string;
  requested_by: string;
  equipment_name: string;
  equipment_type: string;
  brand: string | null;
  model: string | null;
  custom_prompt: string | null;
  resolved_prompt: string | null;
  status: EquipmentImageJobStatus;
  provider: string;
  provider_model: string;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  error_category: ErrorCategory | null;
  preview_data_url: string | null;
  preview_storage_path: string | null;
  provider_latency_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type CreateEquipmentImageJobInput = {
  organizationId: string;
  requestedBy: string;
  equipmentName: string;
  equipmentType: string;
  brand?: string | null;
  model?: string | null;
  customPrompt?: string | null;
};

export type CreateEquipmentImageJobResult = {
  jobId: string;
  status: EquipmentImageJobStatus;
};

export type EquipmentImageJobStatusResult = {
  jobId: string;
  status: EquipmentImageJobStatus;
  resolvedPrompt: string | null;
  previewDataUrl: string | null;
  attemptCount: number;
  lastError: string | null;
  errorCategory: ErrorCategory | null;
  completedAt: string | null;
  createdAt: string;
  expiresAt: string;
};
