import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) return auth.response;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return new Response("Unauthorized", { status: 401 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial data
      const sendSnapshot = async () => {
        try {
          const now = new Date().toISOString();
          const todayStart = now.slice(0, 10) + "T00:00:00.000Z";

          const [paymentsResult, attendanceResult, membersResult] = await Promise.all([
            supabase.from("payments").select("amount,created_at,status").gte("created_at", todayStart).limit(50),
            supabase.from("attendance_sessions").select("member_id,check_in_at").gte("check_in_at", todayStart).limit(100),
            supabase.from("memberships").select("id,status").eq("status", "active").limit(1)
          ]);

          const todayRevenue = (paymentsResult.data ?? [])
            .filter((p) => p.status === "paid" || p.status === "partially_refunded")
            .reduce((sum, p) => sum + Number(p.amount), 0);

          sendEvent("revenue", { amount: todayRevenue, timestamp: now });
          sendEvent("attendance", { count: (attendanceResult.data ?? []).length, timestamp: now });
          sendEvent("active_subscriptions", { count: (membersResult.data ?? []).length, timestamp: now });
          sendEvent("heartbeat", { timestamp: now });
        } catch {
          sendEvent("error", { message: "Snapshot fetch failed" });
        }
      };

      sendSnapshot();

      // Poll every 10 seconds for live updates
      const interval = setInterval(sendSnapshot, 10000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
