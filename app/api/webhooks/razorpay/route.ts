import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "../payment/route";

export async function POST(request: Request): Promise<NextResponse> {
  return handlePaymentWebhook(request);
}
