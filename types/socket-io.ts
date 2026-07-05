import type { NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";

type SocketServerWithIO = HTTPServer & {
  io?: boolean;
};

type SocketWithServer = NetSocket & {
  server: SocketServerWithIO;
};

export type NextApiResponseServerIO = NextApiResponse & {
  socket: SocketWithServer;
};
