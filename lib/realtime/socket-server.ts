import "server-only";

import { Server as SocketIOServer, type DefaultEventsMap, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HTTPServer } from "http";
import { createRedisClientFromUrl } from "@/lib/cache/redis";
import { subscribeToEvents } from "./event-bus";
import type { AttendanceEvent } from "./event-bus";

const SOCKET_PATH = "/api/socket.io";

let io: SocketIOServer | null = null;

type SocketUser = {
  id?: string;
};

type AttendanceSocketData = {
  user?: SocketUser;
};

type AttendanceSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, AttendanceSocketData>;

export function getSocketIO(): SocketIOServer | null {
  return io;
}

function broadcastEvent(event: AttendanceEvent): void {
  if (!io) return;

  const { type, ...rest } = event;
  const socketEventName = `attendance:${type}`;
  const hasOrganizationId = "organization_id" in rest && rest.organization_id;
  const hasBranchId = "branch_id" in rest && rest.branch_id;
  const hasMemberId = "member_id" in rest && rest.member_id;

  // occupancy and alerts go org-wide (not member-scoped)
  if (type === "occupancy_update" || type === "alert") {
    if (hasOrganizationId) io.to(`org:${rest.organization_id}`).emit(socketEventName, rest);
    io.emit(socketEventName, rest);
    return;
  }

  // member-scoped events go to org room + branch room + member room
  if (hasOrganizationId) io.to(`org:${rest.organization_id}`).emit(socketEventName, rest);
  if (hasBranchId) io.to(`branch:${rest.branch_id}`).emit(socketEventName, rest);
  if (hasMemberId) io.to(`member:${rest.member_id}`).emit(socketEventName, rest);
}

export async function initSocketServer(server: HTTPServer): Promise<SocketIOServer | null> {
  if (io) return io;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("[Socket] REDIS_URL not configured, socket.io running without adapter");
  }

  io = new SocketIOServer(server, {
    path: SOCKET_PATH,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
  });

  if (redisUrl) {
    try {
      const pubClient = createRedisClientFromUrl(redisUrl);
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);

      if (pubClient.driver === "real" && subClient.driver === "real") {
        io.adapter(createAdapter(pubClient as never, subClient as never));
        console.log("[Socket] Redis adapter connected");
      } else {
        console.warn("[Socket] Redis package unavailable, running without socket adapter");
      }
    } catch (err) {
      console.error("[Socket] Failed to connect Redis adapter:", err);
    }
  }

  // Subscribe to event bus and bridge to socket.io
  subscribeToEvents(broadcastEvent).catch((err) => {
    console.error("[Socket] Failed to subscribe to event bus:", err);
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
        }
      );
      if (!response.ok) throw new Error("Invalid token");
      const user = await response.json();
      socket.data.user = user as SocketUser;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: AttendanceSocket) => {
    const user = socket.data.user;
    console.log(`[Socket] User connected: ${user?.id || "unknown"}`);

    socket.on("join:organization", (orgId: string) => {
      socket.join(`org:${orgId}`);
    });

    socket.on("join:branch", (branchId: string) => {
      socket.join(`branch:${branchId}`);
    });

    socket.on("join:member", (memberId: string) => {
      socket.join(`member:${memberId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] User disconnected: ${user?.id || "unknown"} (${reason})`);
    });
  });

  console.log("[Socket] Server initialized");
  return io;
}

export type SocketEventPayload = Record<string, unknown>;

export function emitToOrganization(
  orgId: string,
  event: string,
  data: SocketEventPayload
): void {
  io?.to(`org:${orgId}`).emit(event, data);
}

export function emitToBranch(
  branchId: string,
  event: string,
  data: SocketEventPayload
): void {
  io?.to(`branch:${branchId}`).emit(event, data);
}

export function emitToMember(
  memberId: string,
  event: string,
  data: SocketEventPayload
): void {
  io?.to(`member:${memberId}`).emit(event, data);
}

export function emitToAll(event: string, data: SocketEventPayload): void {
  io?.emit(event, data);
}
