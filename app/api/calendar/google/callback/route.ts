import { NextResponse } from "next/server";
import {
  exchangeGoogleCodeForTokens,
  parseGoogleState,
  upsertGoogleCalendarTokens,
} from "@/features/integrations/services/google-calendar-service";

function renderResultPage(title: string, body: string) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; min-height: 100vh; place-items: center; margin: 0; padding: 24px; }
      main { max-width: 560px; border: 1px solid rgba(148,163,184,.25); background: rgba(15,23,42,.9); border-radius: 24px; padding: 28px; box-shadow: 0 24px 80px rgba(0,0,0,.35); }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { line-height: 1.7; color: #cbd5e1; }
      button { margin-top: 20px; background: #c8f24a; color: #0f172a; border: 0; border-radius: 10px; padding: 12px 18px; font-weight: 700; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${body}</p>
      <button onclick="window.close()">Close window</button>
    </main>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return renderResultPage("Google Calendar connection failed", `Google returned: ${error}.`);
  }

  if (!code || !state) {
    return renderResultPage("Google Calendar connection failed", "Missing authorization code or state.");
  }

  try {
    const parsed = parseGoogleState(state);
    const tokens = await exchangeGoogleCodeForTokens(code);

    await upsertGoogleCalendarTokens({
      organizationId: parsed.organizationId,
      userId: parsed.userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
    });

    return renderResultPage("Google Calendar connected", "The calendar connection is active. Return to the integrations page and refresh if the status does not update automatically.");
  } catch (err) {
    return renderResultPage(
      "Google Calendar connection failed",
      err instanceof Error ? err.message : "Unexpected callback error.",
    );
  }
}
