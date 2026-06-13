type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

function loadWindowMs(): number {
  const env = process.env.RATE_LIMIT_WINDOW_MS;
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 60_000;
}

function loadMaxRequests(label: string): number {
  const envKey = `RATE_LIMIT_MAX_${label.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
  const env = process.env[envKey];
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 10;
}

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export function checkRateLimitWithEnv(key: string, label: string, envMaxRequests?: number, envWindowMs?: number): { allowed: boolean; retryAfterMs: number } {
  const effectiveMax = envMaxRequests ?? loadMaxRequests(label);
  const effectiveWindow = envWindowMs ?? loadWindowMs();
  return checkRateLimit(key, effectiveMax, effectiveWindow);
}

export function resetRateLimit(key: string) {
  store.delete(key);
}
