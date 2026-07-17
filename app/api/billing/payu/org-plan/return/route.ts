import { NextResponse } from "next/server";
import { finalizePayuOrgSubscriptionCheckoutAction } from "@/features/billing/services/org-subscription-autodebit-service";

async function handleReturn(request: Request) {
  const url = new URL(request.url);
  const rawBody = request.method === "GET"
    ? url.searchParams.toString()
    : await request.text();

  const result = await finalizePayuOrgSubscriptionCheckoutAction({ rawBody });

  const redirectUrl = new URL("/organization/plan", request.url);
  if (result.success) {
    redirectUrl.searchParams.set("payment", "success");
  } else {
    redirectUrl.searchParams.set("payment", "failed");
    redirectUrl.searchParams.set("message", result.error.slice(0, 160));
  }

  return NextResponse.redirect(redirectUrl, 303);
}

export async function GET(request: Request) {
  return handleReturn(request);
}

export async function POST(request: Request) {
  return handleReturn(request);
}
