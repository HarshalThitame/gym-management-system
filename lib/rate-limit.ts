import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type Bucket = {
  count: number;
  resetAt: number;
};

const fallbackBuckets = new Map<string, Bucket>();

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { data, error } = await supabase.rpc("check_api_rate_limit", {
      bucket_key: key,
      max_requests: limit,
      window_seconds: Math.max(1, Math.ceil(windowMs / 1000))
    });
    const result = data?.[0];

    if (!error && result) {
      const resetAt = new Date(result.reset_at).getTime();
      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetAt,
        retryAfterMs: Math.max(0, resetAt - Date.now())
      };
    }
  }

  return checkFallbackRateLimit(key, limit, windowMs);
}

function checkFallbackRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = fallbackBuckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    fallbackBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, retryAfterMs: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt, retryAfterMs: Math.max(0, current.resetAt - now) };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt, retryAfterMs: 0 };
}
