import { NextRequest, NextResponse } from "next/server";
import { addClient, removeClient } from "@/lib/sse/notify";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ticketId = request.nextUrl.searchParams.get("ticketId");
  const channel = request.nextUrl.searchParams.get("channel");
  const clientKey = ticketId ? `ticket:${ticketId}` : channel ? `channel:${channel}` : null;

  if (!clientKey) {
    return NextResponse.json({ error: "ticketId or channel parameter required." }, { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      addClient(clientKey, send);

      send(JSON.stringify({ event: "connected", clientKey, timestamp: new Date().toISOString() }));

      const interval = setInterval(() => {
        send(JSON.stringify({ event: "ping", timestamp: new Date().toISOString() }));
      }, 30000);

      request.signal.addEventListener("abort", () => {
        removeClient(clientKey, send);
        clearInterval(interval);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
