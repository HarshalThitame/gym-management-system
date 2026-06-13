/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        const supabase = getSupabaseAdminClient();
        if (!supabase) { send("error", { message: "No admin client" }); return; }
        const s = supabase as any;
        const now = new Date().toISOString();

        try {
          // Live metrics
          const { data: live } = await s.from("obs_live_metrics").select("*").order("recorded_at", { ascending: false }).limit(50);
          if (live && live.length > 0) send("live_metrics", live);

          // Service health
          const { data: services } = await s.from("observability_services").select("service_name, status");
          if (services) send("service_health", services);

          // Active incidents
          const { data: incidents } = await s.from("observability_incidents").select("id,title,severity,status").not("status", "in", '("resolved","closed")').limit(10);
          if (incidents) send("active_incidents", incidents);

          // Infra spot check
          const { data: infra } = await s.from("obs_infra_metrics").select("host_name,cpu_usage_pct,memory_usage_pct,disk_usage_pct").order("collected_at", { ascending: false }).limit(10);
          if (infra) send("infra_snapshot", infra);

          // Queue depths
          const { data: queues } = await s.from("observability_queues").select("queue_name,current_depth,status");
          if (queues) send("queue_status", queues);

          send("heartbeat", { timestamp: now });
        } catch { send("error", { message: "Poll failed" }); }
      };

      poll();
      const interval = setInterval(poll, 5000);
      request.signal.addEventListener("abort", () => { clearInterval(interval); controller.close(); });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive", "X-Accel-Buffering": "no"
    }
  });
}
