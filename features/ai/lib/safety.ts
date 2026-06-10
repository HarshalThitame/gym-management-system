import type { Json } from "@/types/database";

export const aiSafetyDisclaimer =
  "AI guidance is educational and must be reviewed by qualified gym staff before changes to training, nutrition, health, or membership operations are applied.";

const blockedPatterns = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /medical\s+diagnosis/i,
  /prescribe\s+(medication|drugs)/i,
  /guarantee\s+(weight\s+loss|results|revenue)/i,
  /payment\s+card|cvv|card\s+number/i
];

const sensitivePatterns = [
  /\b\d{12,19}\b/g,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d[\d\s-]{8,}\d)\b/g
];

export type AiSafetyResult = {
  allowed: boolean;
  flags: string[];
  sanitizedText: string;
};

export function evaluatePromptSafety(input: string): AiSafetyResult {
  const flags = blockedPatterns
    .filter((pattern) => pattern.test(input))
    .map((pattern) => pattern.source);

  return {
    allowed: flags.length === 0,
    flags,
    sanitizedText: redactSensitiveText(input.trim().slice(0, 6000))
  };
}

export function redactSensitiveText(input: string) {
  return sensitivePatterns.reduce((text, pattern) => text.replace(pattern, "[redacted]"), input);
}

export function appendSafetyDisclaimer(content: string) {
  if (content.includes(aiSafetyDisclaimer)) {
    return content;
  }

  return `${content.trim()}\n\n${aiSafetyDisclaimer}`;
}

export function validateAiOutput(input: { content: string; allowMarketingClaims?: boolean }) {
  const flags: string[] = [];

  if (/diagnos|prescrib|treats?\s+(injury|disease|diabetes|hypertension)/i.test(input.content)) {
    flags.push("medical_claim");
  }

  if (!input.allowMarketingClaims && /guarantee|guaranteed|100%\s+result/i.test(input.content)) {
    flags.push("unsubstantiated_claim");
  }

  if (/payment card|cvv|card number/i.test(input.content)) {
    flags.push("sensitive_financial_data");
  }

  return {
    valid: flags.length === 0,
    flags
  };
}

export function minimizeFitnessContext<TRecord extends Record<string, unknown>>(input: TRecord): Json {
  return JSON.parse(JSON.stringify(input, (_key, value: unknown) => {
    if (typeof value !== "string") {
      return value;
    }

    return redactSensitiveText(value);
  })) as Json;
}

export function hashPrompt(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(16);
}
