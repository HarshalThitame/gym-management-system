import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const clients = new Map<string, Set<(data: string) => void>>();

export function notifyDomainCheck(domainId: string, data: Record<string, unknown>) {
  const listeners = clients.get(domainId);
  if (listeners) {
    const payload = JSON.stringify({ event: "check_complete", domainId, ...data });
    for (const send of listeners) {
      send(payload);
    }
  }
}

export async function GET(request: NextRequest) {
  const domainId = request.nextUrl.searchParams.get("domainId");
  if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      if (!clients.has(domainId)) clients.set(domainId, new Set());
      const listeners = clients.get(domainId)!;
      listeners.add(send);

      send(JSON.stringify({ event: "connected", domainId }));

      const interval = setInterval(() => {
        send(JSON.stringify({ event: "ping", timestamp: new Date().toISOString() }));
      }, 30000);

      request.signal.addEventListener("abort", () => {
        listeners.delete(send);
        if (listeners.size === 0) clients.delete(domainId);
        clearInterval(interval);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
