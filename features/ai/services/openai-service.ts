import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertFeature } from "@/lib/tenant";
import type { Json } from "@/types/database";
import { appendSafetyDisclaimer, evaluatePromptSafety, hashPrompt, validateAiOutput } from "../lib/safety";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const AI_TEXT_TIMEOUT_MS = 20_000;
const AI_EMBEDDING_TIMEOUT_MS = 12_000;

type GenerateTextInput = {
  featureKey: string;
  prompt: string;
  fallback: string;
  gymId?: string | null;
  userId?: string | null;
  maxOutputTokens?: number;
};

type AiFeatureContext = {
  organizationId?: string | null;
  gymId?: string | null;
  userId?: string | null;
};

type GenerateTextResult = {
  content: string;
  status: "success" | "fallback" | "blocked" | "error";
  model: string;
  safetyFlags: string[];
};

type AppSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ResponsesApiOutput = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

type EmbeddingApiOutput = {
  data?: Array<{
    embedding?: number[];
  }>;
};

export async function generateAiText(input: GenerateTextInput): Promise<GenerateTextResult> {
  await assertAiFeature(input);

  const startedAt = Date.now();
  const model = readConfiguredEnv("OPENAI_MODEL");
  const observationModel = model ?? "not-configured";
  const apiKey = process.env.OPENAI_API_KEY;
  const safety = evaluatePromptSafety(input.prompt);

  if (!safety.allowed) {
    await recordAiObservation({
      gymId: input.gymId ?? null,
      userId: input.userId ?? null,
      featureKey: input.featureKey,
      model: observationModel,
      prompt: input.prompt,
      latencyMs: Date.now() - startedAt,
      status: "blocked",
      safetyFlags: safety.flags,
      errorMessage: "Prompt blocked by safety policy."
    });

    return {
      content: appendSafetyDisclaimer(input.fallback),
      status: "blocked",
      model: observationModel,
      safetyFlags: safety.flags
    };
  }

  if (!apiKey || !model) {
    await recordAiObservation({
      gymId: input.gymId ?? null,
      userId: input.userId ?? null,
      featureKey: input.featureKey,
      model: observationModel,
      prompt: input.prompt,
      latencyMs: Date.now() - startedAt,
      status: "fallback",
      safetyFlags: [],
      errorMessage: !apiKey ? "OPENAI_API_KEY is not configured." : "OPENAI_MODEL is not configured."
    });

    return {
      content: appendSafetyDisclaimer(input.fallback),
      status: "fallback",
      model: observationModel,
      safetyFlags: []
    };
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      signal: AbortSignal.timeout(AI_TEXT_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        input: safety.sanitizedText,
        max_output_tokens: input.maxOutputTokens ?? 700
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    const body = await response.json() as ResponsesApiOutput;
    const rawContent = extractResponseText(body) || input.fallback;
    const outputSafety = validateAiOutput({ content: rawContent });
    const content = appendSafetyDisclaimer(outputSafety.valid ? rawContent : input.fallback);

    await recordAiObservation({
      gymId: input.gymId ?? null,
      userId: input.userId ?? null,
      featureKey: input.featureKey,
      model,
      prompt: input.prompt,
      latencyMs: Date.now() - startedAt,
      status: outputSafety.valid ? "success" : "blocked",
      safetyFlags: outputSafety.flags,
      promptTokens: body.usage?.input_tokens ?? 0,
      completionTokens: body.usage?.output_tokens ?? 0,
      totalTokens: body.usage?.total_tokens ?? 0,
      errorMessage: outputSafety.valid ? null : "Model output blocked by safety policy."
    });

    return {
      content,
      status: outputSafety.valid ? "success" : "blocked",
      model,
      safetyFlags: outputSafety.flags
    };
  } catch (error) {
    await recordAiObservation({
      gymId: input.gymId ?? null,
      userId: input.userId ?? null,
      featureKey: input.featureKey,
      model,
      prompt: input.prompt,
      latencyMs: Date.now() - startedAt,
      status: "error",
      safetyFlags: [],
      errorMessage: error instanceof Error ? error.message : "Unknown OpenAI error."
    });

    return {
      content: appendSafetyDisclaimer(input.fallback),
      status: "error",
      model,
      safetyFlags: []
    };
  }
}

// Optional tenant context was added so embedding provider calls can enforce SaaS package gating.
export async function generateEmbedding(input: string, context?: AiFeatureContext) {
  await assertAiFeature(context ?? {});

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    signal: AbortSignal.timeout(AI_EMBEDDING_TIMEOUT_MS),
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
      input: input.slice(0, 8000)
    })
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json() as EmbeddingApiOutput;
  return body.data?.[0]?.embedding ?? null;
}

async function assertAiFeature(input: AiFeatureContext) {
  const organizationId = input.organizationId ?? await resolveAiOrganizationId(input);
  if (!organizationId) {
    throw new Error("Feature not available on your current plan.");
  }

  await assertFeature(organizationId, "aiEnabled");
}

async function resolveAiOrganizationId(input: AiFeatureContext) {
  const supabase = await createSupabaseServerClient();

  if (input.gymId) {
    const organizationId = await getOrganizationIdForGym(supabase, input.gymId);
    if (organizationId) {
      return organizationId;
    }
  }

  if (!input.userId) {
    return null;
  }

  const [memberResult, trainerResult, branchUserResult] = await Promise.all([
    supabase.from("members").select("gym_id").eq("user_id", input.userId).maybeSingle(),
    supabase.from("trainers").select("gym_id").eq("user_id", input.userId).maybeSingle(),
    supabase.from("branch_users").select("organization_id").eq("user_id", input.userId).eq("status", "active").maybeSingle()
  ]);

  if (branchUserResult.error) {
    throw new Error(branchUserResult.error.message);
  }

  if (branchUserResult.data?.organization_id) {
    return branchUserResult.data.organization_id;
  }

  if (memberResult.error) {
    throw new Error(memberResult.error.message);
  }

  if (memberResult.data?.gym_id) {
    const organizationId = await getOrganizationIdForGym(supabase, memberResult.data.gym_id);
    if (organizationId) {
      return organizationId;
    }
  }

  if (trainerResult.error) {
    throw new Error(trainerResult.error.message);
  }

  if (trainerResult.data?.gym_id) {
    return getOrganizationIdForGym(supabase, trainerResult.data.gym_id);
  }

  return null;
}

async function getOrganizationIdForGym(supabase: AppSupabase, gymId: string) {
  const { data, error } = await supabase.from("gyms").select("organization_id").eq("id", gymId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return data?.organization_id ?? null;
}

function readConfiguredEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

async function recordAiObservation(input: {
  gymId?: string | null;
  userId?: string | null;
  featureKey: string;
  model: string;
  prompt: string;
  latencyMs: number;
  status: "success" | "fallback" | "error" | "blocked";
  safetyFlags: string[];
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return;
  }

  await supabase.from("ai_observability_logs").insert({
    gym_id: input.gymId ?? null,
    user_id: input.userId ?? null,
    feature_key: input.featureKey,
    provider: "openai",
    model: input.model,
    prompt_hash: hashPrompt(input.prompt),
    prompt_tokens: input.promptTokens ?? 0,
    completion_tokens: input.completionTokens ?? 0,
    total_tokens: input.totalTokens ?? 0,
    latency_ms: input.latencyMs,
    estimated_cost_cents: 0,
    status: input.status,
    safety_flags: input.safetyFlags as Json,
    error_message: input.errorMessage ?? null
  });
}

function extractResponseText(body: ResponsesApiOutput) {
  if (body.output_text) {
    return body.output_text;
  }

  return body.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text): text is string => Boolean(text))
    .join("\n")
    .trim() ?? "";
}
