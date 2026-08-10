import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

const startSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

function liveKitConfig() {
  const serverUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!serverUrl || !apiKey || !apiSecret) return null;
  return { serverUrl, apiKey, apiSecret };
}

function requireLiveKitConfig() {
  const config = liveKitConfig();
  if (!config) {
    const error = new Error('Live streaming is not configured on this server');
    (error as any).statusCode = 503;
    (error as any).name = 'LIVE_NOT_CONFIGURED';
    throw error;
  }
  return config;
}

function liveKitHttpUrl(serverUrl: string) {
  if (serverUrl.startsWith('wss://')) return `https://${serverUrl.slice('wss://'.length)}`;
  if (serverUrl.startsWith('ws://')) return `http://${serverUrl.slice('ws://'.length)}`;
  return serverUrl;
}

function roomService() {
  const config = requireLiveKitConfig();
  return new RoomServiceClient(
    liveKitHttpUrl(config.serverUrl),
    config.apiKey,
    config.apiSecret,
  );
}

async function deleteLiveKitRoom(roomName: string, log?: FastifyRequest['log']) {
  if (!roomName) return;
  try {
    await roomService().deleteRoom(roomName);
  } catch (error) {
    // Deleting an already-finished room is operationally idempotent. The DB is
    // still the discovery authority; log the transport failure for observability.
    log?.warn({ err: error, roomName }, 'LiveKit room deletion failed or room was already absent');
  }
}

async function createLiveKitToken(input: {
  userId: string;
  username: string;
  roomName: string;
  canPublish: boolean;
}) {
  const { apiKey, apiSecret } = requireLiveKitConfig();
  const token = new AccessToken(apiKey, apiSecret, {
    identity: input.userId,
    name: input.username,
    ttl: '10m',
    metadata: JSON.stringify({ userId: input.userId, role: input.canPublish ? 'host' : 'viewer' }),
  });

  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    canPublish: input.canPublish,
    canSubscribe: true,
    canPublishData: true,
    ...(input.canPublish
      ? {
          canPublishSources: [
            TrackSource.CAMERA,
            TrackSource.MICROPHONE,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
          ],
        }
      : {}),
  });

  return token.toJwt();
}

async function blockedBetween(userId: string, otherUserId: string) {
  if (userId === otherUserId) return false;
  return Boolean(await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
    select: { id: true },
  }));
}

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isVerified: true,
} as const;

async function adjustViewerCount(roomName: string, delta: 1 | -1, participantIdentity?: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { streamKey: roomName },
    select: { id: true, userId: true, status: true },
  });
  if (!stream || stream.status !== 'live') return;
  if (participantIdentity && participantIdentity === stream.userId) return;

  // Atomic DB arithmetic avoids lost increments when LiveKit emits concurrent
  // participant webhooks. The decrement predicate prevents values below zero.
  if (delta === 1) {
    await prisma.liveStream.updateMany({
      where: { id: stream.id, status: 'live' },
      data: { viewerCount: { increment: 1 } },
    });
  } else {
    await prisma.liveStream.updateMany({
      where: { id: stream.id, status: 'live', viewerCount: { gt: 0 } },
      data: { viewerCount: { decrement: 1 } },
    });
  }
}

export async function liveRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/webhook+json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.post('/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    const config = requireLiveKitConfig();
    const authorization = req.headers.authorization;
    if (!authorization || Array.isArray(authorization) || typeof req.body !== 'string') {
      return reply.status(400).send({ error: 'INVALID_LIVEKIT_WEBHOOK' });
    }

    try {
      const receiver = new WebhookReceiver(config.apiKey, config.apiSecret);
      const event = await receiver.receive(req.body, authorization);
      const roomName = event.room?.name;
      if (!roomName) return reply.send({ received: true });

      if (event.event === 'participant_joined') {
        await adjustViewerCount(roomName, 1, event.participant?.identity);
      } else if (event.event === 'participant_left' || event.event === 'participant_connection_aborted') {
        await adjustViewerCount(roomName, -1, event.participant?.identity);
      } else if (event.event === 'room_finished') {
        await prisma.liveStream.updateMany({
          where: { streamKey: roomName, status: 'live' },
          data: { status: 'ended', endedAt: new Date(), viewerCount: 0 },
        });
      }

      return reply.send({ received: true });
    } catch (error) {
      req.log.warn({ err: error }, 'Rejected invalid LiveKit webhook');
      return reply.status(401).send({ error: 'INVALID_LIVEKIT_SIGNATURE' });
    }
  });

  app.get('/config/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = liveKitConfig();
    return reply.send({ configured: Boolean(config), serverUrl: config?.serverUrl ?? null });
  });

  app.post('/start', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const username = (req as any).username as string;
    const { title } = startSchema.parse(req.body);
    const config = requireLiveKitConfig();

    const previousStreams = await prisma.liveStream.findMany({
      where: { userId, status: 'live' },
      select: { id: true, streamKey: true },
    });
    if (previousStreams.length > 0) {
      await prisma.liveStream.updateMany({
        where: { id: { in: previousStreams.map((stream) => stream.id) }, status: 'live' },
        data: { status: 'ended', endedAt: new Date(), viewerCount: 0 },
      });
      await Promise.allSettled(
        previousStreams.map((stream) => deleteLiveKitRoom(stream.streamKey, req.log)),
      );
    }

    const roomName = `live_${randomUUID()}`;
    const stream = await prisma.liveStream.create({
      data: {
        userId,
        title,
        status: 'live',
        streamKey: roomName,
      },
      include: { user: { select: publicUserSelect } },
    });

    const token = await createLiveKitToken({ userId, username, roomName, canPublish: true });
    return reply.status(201).send({
      stream,
      connection: { serverUrl: config.serverUrl, roomName, token, role: 'host' },
    });
  });

  app.post('/:id/join', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const username = (req as any).username as string;
    const config = requireLiveKitConfig();

    const stream = await prisma.liveStream.findFirst({
      where: {
        id,
        status: 'live',
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      include: { user: { select: publicUserSelect } },
    });
    if (!stream || await blockedBetween(userId, stream.userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Live stream not found' });
    }

    const isHost = stream.userId === userId;
    const token = await createLiveKitToken({
      userId,
      username,
      roomName: stream.streamKey,
      canPublish: isHost,
    });

    return reply.send({
      stream,
      connection: {
        serverUrl: config.serverUrl,
        roomName: stream.streamKey,
        token,
        role: isHost ? 'host' : 'viewer',
      },
    });
  });

  app.post('/:id/end', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const userId = (req as any).userId as string;
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      select: { userId: true, status: true, streamKey: true },
    });
    if (!stream || stream.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    if (stream.status !== 'ended') {
      await prisma.liveStream.update({
        where: { id },
        data: { status: 'ended', endedAt: new Date(), viewerCount: 0 },
      });
    }
    await deleteLiveKitRoom(stream.streamKey, req.log);
    return reply.send({ message: 'Stream ended' });
  });

  app.get('/:id', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const stream = await prisma.liveStream.findFirst({
      where: {
        id,
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      include: { user: { select: publicUserSelect } },
    });
    if (!stream || (viewerId && await blockedBetween(viewerId, stream.userId))) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Stream not found' });
    }
    const { streamKey: _roomName, ...publicStream } = stream;
    return reply.send({ stream: publicStream });
  });

  app.get('/', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const viewerId = (req as any).userId as string | undefined;
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query);

    let blockedIds: string[] = [];
    if (viewerId) {
      const blocks = await prisma.userBlock.findMany({
        where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
        select: { blockerId: true, blockedId: true },
      });
      blockedIds = blocks.map((block) => block.blockerId === viewerId ? block.blockedId : block.blockerId);
    }

    const streams = await prisma.liveStream.findMany({
      where: {
        status: 'live',
        userId: { notIn: blockedIds },
        user: {
          isBanned: false,
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
        },
      },
      orderBy: [{ viewerCount: 'desc' }, { startedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: publicUserSelect } },
    });

    return reply.send({
      streams: streams.map(({ streamKey: _roomName, ...stream }) => stream),
      page,
      limit,
    });
  });
}
