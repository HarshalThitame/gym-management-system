import { NextRequest, NextResponse } from "next/server";
import { getSseClients } from "../sse";

export async function GET(request: NextRequest) {
  const domainId = request.nextUrl.searchParams.get("domainId");
  if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });

  const clients = getSseClients();
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
