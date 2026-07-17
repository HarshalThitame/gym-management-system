import { NextResponse } from "next/server";
import { resolvePlatformPayuCredentials } from "@/features/billing/payu/platform-payu-config";
import { getPayuApiBaseUrl, getPayuConfig } from "@/features/billing/payu/payu-config";

export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => null);
    let hasFields = false;
    formData?.forEach(() => {
      hasFields = true;
    });
    if (!formData || !hasFields) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PAYU_RELAY_EMPTY_PAYLOAD",
            message: "Missing PayU transaction payload.",
          },
        },
        { status: 400 },
      );
    }

    const credentials = await resolvePlatformPayuCredentials();
    const environment = credentials?.environment || getPayuConfig().environment;
    const baseUrl = getPayuApiBaseUrl(environment);
    const actionUrl = new URL("/_payment", baseUrl).toString();

    const fields = Array.from(formData.entries())
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}" />`)
      .join("");

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to PayU</title>
  </head>
  <body>
    <form id="payu-relay" action="${escapeHtml(actionUrl)}" method="post">
      ${fields}
    </form>
    <script>
      document.getElementById("payu-relay").submit();
    </script>
    <noscript>
      <button type="submit" form="payu-relay">Continue to PayU</button>
    </noscript>
  </body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PayU relay configuration failed.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PAYU_RELAY_CONFIGURATION_ERROR",
          message,
        },
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "PayU relay accepts POST requests only.",
      },
    },
    { status: 405 },
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
