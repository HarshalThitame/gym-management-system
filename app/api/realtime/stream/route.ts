import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RealtimeChannel, RealtimeEventType } from "@/features/realtime/services/realtime-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server-Sent Events (SSE) endpoint for real-time streaming
 * 
 * Usage: GET /api/realtime/stream?channel=attendance&event_type=check_in
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel") as RealtimeChannel | null;
  const eventType = searchParams.get("event_type") as RealtimeEventType | null;

  if (!channel) {
    return new Response("Channel is required", { status: 400 });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const adminClient = createAdminClient();

      // Send initial connection message
      const connectMsg = encoder.encode(
        `data: ${JSON.stringify({ type: "connected", channel, timestamp: new Date().toISOString() })}\n\n`
      );
      controller.enqueue(connectMsg);

      // Poll for new events every 2 seconds
      let lastEventTime = new Date().toISOString();
      let isActive = true;

      const pollInterval = setInterval(async () => {
        if (!isActive) {
          clearInterval(pollInterval);
          return;
        }

        try {
          let query = adminClient
            .from("realtime_events")
            .select("*")
            .eq("channel", channel)
            .gt("created_at", lastEventTime)
            .order("created_at", { ascending: true })
            .limit(50);

          if (eventType) {
            query = query.eq("event_type", eventType);
          }

          const { data: events, error } = await query;

          if (error) {
            console.error("[SSE] Query error:", error);
            return;
          }

          if (events && events.length > 0) {
            for (const event of events) {
              const msg = encoder.encode(
                `data: ${JSON.stringify({ type: "event", event, timestamp: new Date().toISOString() })}\n\n`
              );
              controller.enqueue(msg);
            }
            lastEventTime = events[events.length - 1].created_at;
          }

          // Send heartbeat every 30 seconds
          const heartbeat = encoder.encode(
            `data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`
          );
          controller.enqueue(heartbeat);
        } catch (err) {
          console.error("[SSE] Poll error:", err);
        }
      }, 2000);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        isActive = false;
        clearInterval(pollInterval);
        controller.close();
      });

      // Keep connection alive for max 30 minutes
      setTimeout(() => {
        isActive = false;
        clearInterval(pollInterval);
        const closeMsg = encoder.encode(
          `data: ${JSON.stringify({ type: "close", reason: "timeout", timestamp: new Date().toISOString() })}\n\n`
        );
        controller.enqueue(closeMsg);
        controller.close();
      }, 30 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
