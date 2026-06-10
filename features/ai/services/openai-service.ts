import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { appendSafetyDisclaimer, evaluatePromptSafety, hashPrompt, validateAiOutput } from "../lib/safety";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_TEXT_MODEL = "gpt-5.4-mini";
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

type GenerateTextResult = {
  content: string;
  status: "success" | "fallback" | "blocked" | "error";
  model: string;
  safetyFlags: string[];
};

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
  const startedAt = Date.now();
  const model = process.env.OPENAI_MODEL || DEFAULT_TEXT_MODEL;
  const apiKey = process.env.OPENAI_API_KEY;
  const safety = evaluatePromptSafety(input.prompt);

  if (!safety.allowed) {
    await recordAiObservation({
      gymId: input.gymId ?? null,
      userId: input.userId ?? null,
      featureKey: input.featureKey,
      model,
      prompt: input.prompt,
      latencyMs: Date.now() - startedAt,
      status: "blocked",
      safetyFlags: safety.flags,
      errorMessage: "Prompt blocked by safety policy."
    });

    return {
      content: appendSafetyDisclaimer(input.fallback),
      status: "blocked",
      model,
      safetyFlags: safety.flags
    };
  }

  if (!apiKey) {
    await recordAiObservation({
      gymId: input.gymId ?? null,
      userId: input.userId ?? null,
      featureKey: input.featureKey,
      model,
      prompt: input.prompt,
      latencyMs: Date.now() - startedAt,
      status: "fallback",
      safetyFlags: [],
      errorMessage: "OPENAI_API_KEY is not configured."
    });

    return {
      content: appendSafetyDisclaimer(input.fallback),
      status: "fallback",
      model,
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

export async function generateEmbedding(input: string) {
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
