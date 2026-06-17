import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getMonitoringDashboard } from "@/features/monitoring/services/monitoring-service";

export async function GET() {
  try {
    await requireRole(["super_admin"], "/super-admin/monitoring");
    const dashboard = await getMonitoringDashboard();
    return NextResponse.json(dashboard);
  } catch (err: unknown) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[monitoring-refresh] Error:", message);
    return NextResponse.json(
      { error: "Failed to refresh monitoring data" },
      { status: 500 }
    );
  }
}
