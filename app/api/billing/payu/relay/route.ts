import { NextResponse } from "next/server";
import { resolvePlatformPayuCredentials } from "@/features/billing/payu/platform-payu-config";
import { getPayuApiBaseUrl, getPayuConfig } from "@/features/billing/payu/payu-config";

export async function POST(request: Request) {
  void request;

  try {
    const credentials = await resolvePlatformPayuCredentials();
    const environment = credentials?.environment || getPayuConfig().environment;
    const baseUrl = getPayuApiBaseUrl(environment);
    const redirectUrl = new URL("/_payment", baseUrl);

    return NextResponse.redirect(redirectUrl, 307);
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
