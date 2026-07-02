import { NextRequest, NextResponse } from "next/server";

/**
 * API Health Check Endpoint
 * GET /api/v1/health
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
}
