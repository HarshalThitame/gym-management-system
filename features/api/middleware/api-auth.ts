import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, logApiUsage, hasScope, type ApiKey, type ApiScope } from "../services/api-key-service";

export type ApiContext = {
  apiKey: ApiKey;
  startTime: number;
};

/**
 * Extract API key from request headers
 */
export function extractApiKey(request: NextRequest): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check query parameter (not recommended but supported)
  const url = new URL(request.url);
  return url.searchParams.get("api_key");
}

/**
 * Authenticate API request
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<{ apiKey: ApiKey } | NextResponse> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key", message: "Provide API key via Authorization: Bearer <key> or X-API-Key header" },
      { status: 401 }
    );
  }

  const validatedKey = await validateApiKey(apiKey);

  if (!validatedKey) {
    return NextResponse.json(
      { error: "Invalid API key", message: "The provided API key is invalid, expired, or revoked" },
      { status: 401 }
    );
  }

  return { apiKey: validatedKey };
}

/**
 * Check if API key has required scope
 */
export function requireScope(
  context: { apiKey: ApiKey },
  requiredScope: ApiScope
): NextResponse | null {
  if (!hasScope(context.apiKey, requiredScope)) {
    return NextResponse.json(
      {
        error: "Insufficient permissions",
        message: `API key does not have required scope: ${requiredScope}`,
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Rate limiting using in-memory store (for production, use Redis)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  request: NextRequest,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetAt: number } {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const key = `api:${ip}`;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    // New window
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetAt: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set("X-RateLimit-Reset", Math.ceil(resetAt / 1000).toString());
  return response;
}

/**
 * Log API request and response
 */
export async function logApiRequest(
  request: NextRequest,
  response: NextResponse,
  apiKeyId: string | null,
  startTime: number
): Promise<void> {
  const endTime = Date.now();
  const responseTime = endTime - startTime;

  await logApiUsage(
    apiKeyId,
    new URL(request.url).pathname,
    request.method,
    response.status,
    responseTime,
    request.headers.get("x-forwarded-for") || undefined,
    request.headers.get("user-agent") || undefined
  );
}

/**
 * Wrapper for API route handlers with authentication and logging
 */
export function withApiAuth(
  handler: (
    request: NextRequest,
    context: ApiContext
  ) => Promise<NextResponse>,
  options: {
    requiredScope?: ApiScope;
    rateLimit?: number;
  } = {}
) {
  return async (request: NextRequest) => {
    const startTime = Date.now();

    // Rate limiting
    const rateLimit = options.rateLimit || 100;
    const rateLimitResult = checkRateLimit(request, rateLimit);

    if (!rateLimitResult.allowed) {
      const errorResponse = NextResponse.json(
        { error: "Rate limit exceeded", message: "Too many requests. Please try again later." },
        { status: 429 }
      );
      return addRateLimitHeaders(errorResponse, rateLimit, 0, rateLimitResult.resetAt);
    }

    // Authentication
    const authResult = await authenticateApiRequest(request);

    if (authResult instanceof NextResponse) {
      await logApiRequest(request, authResult, null, startTime);
      return addRateLimitHeaders(authResult, rateLimit, rateLimitResult.remaining, rateLimitResult.resetAt);
    }

    // Scope check
    if (options.requiredScope) {
      const scopeError = requireScope(authResult, options.requiredScope);
      if (scopeError) {
        await logApiRequest(request, scopeError, authResult.apiKey.id, startTime);
        return addRateLimitHeaders(scopeError, rateLimit, rateLimitResult.remaining, rateLimitResult.resetAt);
      }
    }

    // Execute handler
    const response = await handler(request, { ...authResult, startTime });

    // Log request
    await logApiRequest(request, response, authResult.apiKey.id, startTime);

    return addRateLimitHeaders(response, rateLimit, rateLimitResult.remaining, rateLimitResult.resetAt);
  };
}
