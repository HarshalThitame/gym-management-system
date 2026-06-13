import { NextResponse } from "next/server";

export function corsHeaders(origin?: string | null) {
  const allowedOrigin = origin && (origin.includes("apex") || origin.includes("localhost") || origin.includes("vercel"))
    ? origin
    : "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-razorpay-signature, x-admin-api-key",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleCors(request: Request) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("origin")),
    });
  }
  return null;
}

export function applyCors(response: NextResponse, request: Request) {
  const headers = corsHeaders(request.headers.get("origin"));
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
