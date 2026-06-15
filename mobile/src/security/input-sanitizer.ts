const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /javascript\s*:/gi,
  /<\s*[^>]*>.*?<\s*\/\s*[^>]*>/gi,
  /data\s*:\s*text\/html/gi,
  /vbscript\s*:/gi,
];

const SQL_INJECTION_PATTERNS = [
  /['"]\s*OR\s*['"]/gi,
  /['"]\s*AND\s*['"]/gi,
  /;\s*DROP\s+TABLE/gi,
  /;\s*DELETE\s+FROM/gi,
  /;\s*UPDATE\s+\w+\s+SET/gi,
  /UNION\s+SELECT/gi,
  /pg_sleep|WAITFOR\s+DELAY/i,
];

const MAX_INPUT_LENGTH = 5000;

export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";
  if (input.length > MAX_INPUT_LENGTH) return input.slice(0, MAX_INPUT_LENGTH);
  return input.trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeInput(value);
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}

export function containsXSS(input: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(input));
}

export function containsSQLInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function validateInput(input: string, fieldName: string): { ok: boolean; error?: string; sanitized?: string } {
  const sanitized = sanitizeInput(input);

  if (containsXSS(sanitized)) {
    return { ok: false, error: `${fieldName} contains potentially unsafe content.` };
  }

  if (containsSQLInjection(sanitized)) {
    return { ok: false, error: `${fieldName} contains invalid characters.` };
  }

  return { ok: true, sanitized };
}
