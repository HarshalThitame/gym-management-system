import { Alert } from "react-native";
import { apiClient } from "@/api/client";
import { getSupabaseClient } from "@/api/supabase";
import { syncEngine } from "@/offline/sync-engine";
import { captureError } from "./error-tracking";

export type ErrorCategory = "network" | "api" | "auth" | "storage" | "sync" | "unknown";

export interface ErrorRecoveryAction {
  category: ErrorCategory;
  message: string;
  recoverable: boolean;
  retryAction?: () => Promise<boolean>;
  fallbackAction?: () => Promise<void>;
}

export async function analyzeError(error: unknown, context?: string): Promise<ErrorRecoveryAction> {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Network request failed") || message.includes("timed out")) {
    return {
      category: "network",
      message: "Network connection lost. Your data will be saved offline and synced when connected.",
      recoverable: true,
      retryAction: async () => {
        const result = await syncEngine.sync("recovery");
        return result.failed === 0;
      },
    };
  }

  if (message.includes("401") || message.includes("UNAUTHORIZED") || message.includes("JWT")) {
    return {
      category: "auth",
      message: "Your session has expired. Please sign in again.",
      recoverable: true,
      retryAction: async () => {
        try {
          const supabase = getSupabaseClient();
          const { data } = await supabase.auth.refreshSession();
          return !!data.session;
        } catch { return false; }
      },
    };
  }

  if (message.includes("403") || message.includes("FORBIDDEN")) {
    return {
      category: "api",
      message: "You don't have permission to perform this action.",
      recoverable: false,
    };
  }

  if (message.includes("429") || message.includes("RATE_LIMITED")) {
    return {
      category: "api",
      message: "Too many requests. Please wait a moment and try again.",
      recoverable: true,
      retryAction: async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return true;
      },
    };
  }

  return {
    category: "unknown",
    message: context ? `${context}: ${message}` : message,
    recoverable: true,
  };
}

export async function handleApiError(error: unknown, context?: string): Promise<void> {
  const action = await analyzeError(error, context);
  captureError(error instanceof Error ? error : new Error(String(error)), { context, category: action.category });

  if (!action.recoverable) {
    Alert.alert("Error", action.message);
    return;
  }
}

export async function executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<{ ok: boolean; data?: T; error?: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (error) {
      const action = await analyzeError(error);
      if (action.category === "network" && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  return { ok: false, error: "Max retries exceeded" };
}
