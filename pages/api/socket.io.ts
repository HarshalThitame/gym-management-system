import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types/socket-io";
import { initSocketServer } from "@/lib/realtime/socket-server";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(_req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket?.server) {
    res.status(500).json({ ok: false, error: "HTTP server not available." });
    return;
  }

  if (!res.socket.server.io) {
    await initSocketServer(res.socket.server);
    res.socket.server.io = true;
  }

  res.status(200).json({ ok: true, socketPath: "/api/socket.io" });
}
