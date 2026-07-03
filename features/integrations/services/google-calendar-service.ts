import "server-only";

import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type CalendarIntegrationRow = Database["public"]["Tables"]["calendar_integrations"]["Row"];

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type GoogleCalendarEvent = {
  id: string;
  htmlLink?: string;
};

export type GoogleOAuthConfigurationStatus = {
  configured: boolean;
  callbackUrl: string | null;
  missing: string[];
  message: string | null;
};

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function getGoogleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || ""
  );
}

function getCallbackUrl() {
  const base = getAppBaseUrl();
  return `${base.replace(/\/$/, "")}/api/calendar/google/callback`;
}

function getStateSigningSecret() {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || ""
  );
}

export function getGoogleOAuthConfigurationStatus(): GoogleOAuthConfigurationStatus {
  const missing: string[] = [];

  if (!getGoogleClientId()) {
    missing.push("GOOGLE_CLIENT_ID");
  }

  if (!getGoogleClientSecret()) {
    missing.push("GOOGLE_CLIENT_SECRET");
  }

  if (!getAppBaseUrl()) {
    missing.push("NEXT_PUBLIC_SITE_URL or APP_URL");
  }

  if (!getStateSigningSecret()) {
    missing.push("GOOGLE_OAUTH_STATE_SECRET");
  }

  const callbackUrl = getAppBaseUrl() ? getCallbackUrl() : null;

  return {
    configured: missing.length === 0,
    callbackUrl,
    missing,
    message: missing.length > 0
      ? `Google Calendar OAuth is not configured. Missing: ${missing.join(", ")}.`
      : null,
  };
}

function ensureGoogleOAuthConfigured() {
  const status = getGoogleOAuthConfigurationStatus();
  if (!status.configured) {
    throw new Error(status.message ?? "Google Calendar OAuth is not configured.");
  }
}

function buildStatePayload(payload: { organizationId: string; userId: string }) {
  const secret = getStateSigningSecret();
  if (!secret) {
    throw new Error("Google OAuth state signing secret is not configured.");
  }

  const raw = Buffer.from(JSON.stringify({
    organizationId: payload.organizationId,
    userId: payload.userId,
    issuedAt: Date.now(),
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  return `${raw}.${signature}`;
}

export function parseGoogleState(state: string) {
  const secret = getStateSigningSecret();
  if (!secret) {
    throw new Error("Google OAuth state signing secret is not configured.");
  }

  const [raw, signature] = state.split(".");
  if (!raw || !signature) {
    throw new Error("Invalid Google OAuth state.");
  }

  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (signature !== expected) {
    throw new Error("Google OAuth state signature mismatch.");
  }

  const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
    organizationId: string;
    userId: string;
    issuedAt: number;
  };

  if (!parsed.organizationId || !parsed.userId) {
    throw new Error("Google OAuth state is incomplete.");
  }

  return parsed;
}

export function getGoogleCalendarAuthUrl(payload: { organizationId: string; userId: string }) {
  ensureGoogleOAuthConfigured();

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", getCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", buildStatePayload(payload));
  return url.toString();
}

export async function exchangeGoogleCodeForTokens(code: string) {
  ensureGoogleOAuthConfigured();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getCallbackUrl(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const data = await response.json() as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to exchange Google OAuth code.");
  }

  return data;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  ensureGoogleOAuthConfigured();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const data = await response.json() as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to refresh Google Calendar access token.");
  }

  return data;
}

export async function upsertGoogleCalendarTokens(params: {
  organizationId: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
}) {
  const adminDb = createAdminClient();
  const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();

  const { data: existing, error: selectError } = await adminDb
    .from("calendar_integrations")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);

  if (existing) {
    const { data, error } = await adminDb
      .from("calendar_integrations")
      .update({
        access_token: params.accessToken,
        refresh_token: params.refreshToken ?? existing.refresh_token,
        token_expires_at: expiresAt,
        sync_enabled: true,
        connected_by: params.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await adminDb
    .from("calendar_integrations")
    .insert({
      organization_id: params.organizationId,
      provider: "google",
      access_token: params.accessToken,
      refresh_token: params.refreshToken ?? null,
      token_expires_at: expiresAt,
      sync_enabled: true,
      sync_classes: true,
      sync_pt_sessions: false,
      calendar_id: "primary",
      connected_by: params.userId,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getValidGoogleAccessToken(integration: CalendarIntegrationRow) {
  const accessToken = integration.access_token;
  const refreshToken = integration.refresh_token;
  const expiresAt = integration.token_expires_at ? Date.parse(integration.token_expires_at) : 0;
  const isFresh = accessToken && expiresAt - Date.now() > 60_000;

  if (isFresh) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error("Google Calendar refresh token is missing. Reconnect the account.");
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken);
  const adminDb = createAdminClient();
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await adminDb
    .from("calendar_integrations")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: tokenExpiresAt,
      refresh_token: refreshed.refresh_token ?? refreshToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  return refreshed.access_token;
}

async function googleCalendarRequest<T>(
  integration: CalendarIntegrationRow,
  path: string,
  init: RequestInit = {},
) {
  const accessToken = await getValidGoogleAccessToken(integration);
  const response = await fetch(`${GOOGLE_CALENDAR_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Google Calendar API request failed.");
  }

  if (response.status === 204) {
    return null as T;
  }

  return await response.json() as T;
}

export async function createGoogleCalendarEvent(
  integration: CalendarIntegrationRow,
  input: {
    summary: string;
    description?: string;
    location?: string;
    start: string;
    end: string;
    timeZone?: string;
  },
) {
  const calendarId = encodeURIComponent(integration.calendar_id || "primary");
  return googleCalendarRequest<GoogleCalendarEvent>(integration, `/calendars/${calendarId}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: input.summary,
      description: input.description ?? "",
      location: input.location ?? "",
      start: {
        dateTime: input.start,
        timeZone: input.timeZone,
      },
      end: {
        dateTime: input.end,
        timeZone: input.timeZone,
      },
    }),
  });
}

export async function updateGoogleCalendarEvent(
  integration: CalendarIntegrationRow,
  eventId: string,
  input: {
    summary: string;
    description?: string;
    location?: string;
    start: string;
    end: string;
    timeZone?: string;
  },
) {
  const calendarId = encodeURIComponent(integration.calendar_id || "primary");
  const encodedEventId = encodeURIComponent(eventId);
  return googleCalendarRequest<GoogleCalendarEvent>(integration, `/calendars/${calendarId}/events/${encodedEventId}`, {
    method: "PUT",
    body: JSON.stringify({
      summary: input.summary,
      description: input.description ?? "",
      location: input.location ?? "",
      start: {
        dateTime: input.start,
        timeZone: input.timeZone,
      },
      end: {
        dateTime: input.end,
        timeZone: input.timeZone,
      },
    }),
  });
}

export async function deleteGoogleCalendarEvent(
  integration: CalendarIntegrationRow,
  eventId: string,
) {
  const calendarId = encodeURIComponent(integration.calendar_id || "primary");
  const encodedEventId = encodeURIComponent(eventId);
  await googleCalendarRequest<null>(integration, `/calendars/${calendarId}/events/${encodedEventId}`, {
    method: "DELETE",
  });
}

export async function testGoogleCalendarConnection(integration: CalendarIntegrationRow) {
  const calendarId = encodeURIComponent(integration.calendar_id || "primary");
  await googleCalendarRequest<Record<string, unknown>>(integration, `/calendars/${calendarId}`);
  return { ok: true };
}
