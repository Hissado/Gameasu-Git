import type { Server as HttpServer } from "node:http";
import { Server as IOServer, type Socket } from "socket.io";
import { db } from "@workspace/db";
import { usersTable, userPresenceTable, conversationParticipantsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger";

let _io: IOServer | null = null;

export function getIO(): IOServer | null {
  return _io;
}

export function initRealtime(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: "*", credentials: false },
    path: "/api/realtime",
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.["token"] as string | undefined) ||
        (socket.handshake.query?.["token"] as string | undefined);
      if (!token) return next(new Error("Token requis"));
      const decoded = Buffer.from(token, "base64").toString();
      const [userId] = decoded.split(":");
      if (!userId) return next(new Error("Token invalide"));
      const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!users[0] || !users[0].isActive) return next(new Error("Utilisateur invalide"));
      socket.data["userId"] = users[0].id;
      socket.data["userName"] = `${users[0].firstName} ${users[0].lastName}`;
      next();
    } catch (e) {
      next(new Error("Auth WS échouée"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data["userId"] as string;
    socket.join(`user:${userId}`);
    await upsertPresence(userId, "online");
    socket.broadcast.emit("presence:update", { userId, status: "online", lastSeenAt: new Date().toISOString() });

    socket.on("conversation:join", async (conversationId: string) => {
      if (typeof conversationId !== "string" || !/^[0-9a-f-]{36}$/i.test(conversationId)) return;
      // RBAC: refuse l'accès aux conversations dont l'utilisateur n'est pas participant.
      const part = await db.select({ id: conversationParticipantsTable.id })
        .from(conversationParticipantsTable)
        .where(and(
          eq(conversationParticipantsTable.conversationId, conversationId),
          eq(conversationParticipantsTable.userId, userId),
        )).limit(1);
      if (!part[0]) {
        socket.emit("conversation:join:denied", { conversationId });
        return;
      }
      socket.join(`conv:${conversationId}`);
    });
    socket.on("conversation:leave", (conversationId: string) => {
      if (typeof conversationId === "string") socket.leave(`conv:${conversationId}`);
    });

    socket.on("typing:start", (conversationId: string) => {
      if (typeof conversationId !== "string") return;
      socket.to(`conv:${conversationId}`).emit("typing:update", {
        conversationId, userId, userName: socket.data["userName"], isTyping: true,
      });
    });
    socket.on("typing:stop", (conversationId: string) => {
      if (typeof conversationId !== "string") return;
      socket.to(`conv:${conversationId}`).emit("typing:update", {
        conversationId, userId, userName: socket.data["userName"], isTyping: false,
      });
    });

    socket.on("presence:heartbeat", async () => {
      await upsertPresence(userId, "online");
    });

    socket.on("disconnect", async () => {
      await upsertPresence(userId, "offline");
      io.emit("presence:update", { userId, status: "offline", lastSeenAt: new Date().toISOString() });
    });
  });

  _io = io;
  logger.info("Realtime socket.io initialized at /api/realtime");
  return io;
}

async function upsertPresence(userId: string, status: "online" | "offline") {
  try {
    const now = new Date();
    await db
      .insert(userPresenceTable)
      .values({ userId, status, lastSeenAt: now })
      .onConflictDoUpdate({
        target: userPresenceTable.userId,
        set: { status, lastSeenAt: now },
      });
  } catch (e) {
    logger.error({ err: e }, "Presence upsert failed");
  }
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  if (!_io) return;
  _io.to(`conv:${conversationId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!_io) return;
  _io.to(`user:${userId}`).emit(event, payload);
}
