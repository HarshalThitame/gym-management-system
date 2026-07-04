import { NextResponse } from "next/server";
import { processJob, cleanupExpiredJobs } from "@/features/organization-owner/services/equipment-image-job-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { processed: number; failed: number; expired: number; cleaned: number } = {
    processed: 0,
    failed: 0,
    expired: 0,
    cleaned: 0,
  };

  try {
    const client = createAdminClient();

    const { data: queuedJobs, error } = await client
      .from("equipment_image_generation_jobs")
      .select("id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(5);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const job of queuedJobs ?? []) {
      try {
        await processJob(job.id);
        results.processed++;
      } catch {
        results.failed++;
      }
    }

    const cleanup = await cleanupExpiredJobs();
    results.expired = cleanup.expired;
    results.cleaned = cleanup.cleaned;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
