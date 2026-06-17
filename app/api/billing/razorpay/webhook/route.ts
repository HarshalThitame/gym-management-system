import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "WEBHOOK_DEPRECATED",
        message: "This webhook endpoint is deprecated. Please use /api/webhooks/razorpay instead.",
        migration_url: "/api/webhooks/razorpay",
      },
    },
    { status: 410 },
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}
