import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import Constants from "expo-constants";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initializeErrorTracking() {
  if (initialized || !SENTRY_DSN) return;

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
      release: `apex-mobile@${Constants.expoConfig?.version ?? "1.0.0"}`,
      tracesSampleRate: 0.2,
      beforeSend: (event) => {
        if (__DEV__) return null;
        return event;
      },
    });
    initialized = true;
  } catch {}
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!initialized || !SENTRY_DSN) {
    if (__DEV__) console.error("[ErrorTracking]", error.message, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  if (!initialized || !SENTRY_DSN) {
    if (__DEV__) console.log(`[${level.toUpperCase()}]`, message);
    return;
  }
  Sentry.captureMessage(message, level);
}

export function setUserContext(userId: string | null, email?: string | null) {
  if (!initialized || !SENTRY_DSN) return;
  if (userId) {
    Sentry.setUser({ id: userId, email: email ?? undefined });
  } else {
    Sentry.setUser(null);
  }
}

export function addBreadcrumb(message: string, category?: string) {
  if (!initialized || !SENTRY_DSN) return;
  Sentry.addBreadcrumb({ message, category, timestamp: Date.now() });
}

export const ErrorTracking = {
  initialize: initializeErrorTracking,
  captureError,
  captureMessage,
  setUser: setUserContext,
  addBreadcrumb,
};
