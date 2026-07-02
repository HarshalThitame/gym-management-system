// Services
export {
  createApiKey,
  getUserApiKeys,
  revokeApiKey,
  validateApiKey,
  logApiUsage,
  hasScope,
  getApiUsageStats,
} from "./services/api-key-service";

export type {
  ApiKey,
  ApiKeyWithKey,
  ApiUsageLog,
  ApiScope,
} from "./services/api-key-service";

// Actions
export {
  createApiKeyAction,
  getUserApiKeysAction,
  revokeApiKeyAction,
  getApiUsageStatsAction,
} from "./actions/api-actions";

// Middleware
export {
  extractApiKey,
  authenticateApiRequest,
  requireScope,
  checkRateLimit,
  addRateLimitHeaders,
  logApiRequest,
  withApiAuth,
} from "./middleware/api-auth";

export type { ApiContext } from "./middleware/api-auth";

// Components
export { ApiKeyManager } from "./components/api-key-manager";
