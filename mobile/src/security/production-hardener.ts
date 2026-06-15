import { Platform } from "react-native";
import Constants from "expo-constants";

const SENSITIVE_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SUPABASE_SECRET_KEY/i,
  /SERVICE_ROLE/i,
  /PRIVATE_KEY/i,
  /API_KEY/i,
  /PASSWORD/i,
  /SECRET/i,
  /TOKEN/i,
];

const SENSITIVE_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "WEB_PUSH_VAPID_PRIVATE_KEY",
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "VERCEL_API_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "CRON_SECRET",
  "E2E_AUTH_PASSWORD",
];

export function validateProductionBuild(): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (__DEV__) {
    warnings.push("Running in development mode - not production build");
    return { safe: false, warnings };
  }

  const envVars = Constants.expoConfig?.extra ?? {};
  for (const key of SENSITIVE_ENV_KEYS) {
    const value = (envVars as Record<string, string>)[key];
    if (value && value.length > 0) {
      if (!key.includes("PUBLIC")) {
        warnings.push(`Sensitive env key may be exposed: ${key}`);
      }
    }
  }

  return { safe: warnings.length === 0, warnings };
}

export function isProductionBuild(): boolean {
  return !__DEV__ && !Constants.expoConfig?.extra?.isDev;
}

export function sanitizeErrorForProduction(error: Error): Error {
  if (__DEV__) return error;
  return new Error("An unexpected error occurred. Please try again.");
}

export function getPublicConfig(): Record<string, string> {
  const extra = Constants.expoConfig?.extra as Record<string, string> ?? {};
  const publicConfig: Record<string, string> = {};

  for (const [key, value] of Object.entries(extra)) {
    if (key.startsWith("EXPO_PUBLIC_") && typeof value === "string") {
      publicConfig[key] = value;
    }
  }

  return publicConfig;
}
