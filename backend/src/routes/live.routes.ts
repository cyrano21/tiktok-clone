import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AccessToken, TrackSource, WebhookReceiver } from 'livekit-server-sdk';
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
  await prisma.$transaction(async (tx) => {
    const stream = await tx.liveStream.findUnique({
      where: { streamKey: roomName },
      select: { id: true, userId: true, viewerCount: true, status: true },
    });
    if (!stream || stream.status !== 'live') return;
    if (participantIdentity && participantIdentity === stream.userId) return;

    await tx.liveStream.update({
      where: { id: stream.id },
      data: { viewerCount: Math.max(0, stream.viewerCount + delta) },
    });
  });
}

export async function liveRoutes(app: FastifyInstance) {
  // LiveKit signs webhook requests and sends application/webhook+json. Keeping
  // the exact raw string is mandatory for signature verification.
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

    await prisma.liveStream.updateMany({
      where: { userId, status: 'live' },
      data: { status: 'ended', endedAt: new Date(), viewerCount: 0 },
    });

    const roomName = `live_${randomUUID()}`;
    const stream = await prisma.liveStream.create({
      data: {
        userId,
        title,
        status: 'live',
        // Backwards-compatible column. The value is a room identifier, not a
        // publishing secret; clients receive it only inside authenticated joins.
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
    const stream = await prisma.liveStream.findUnique({ where: { id }, select: { userId: true, status: true } });
    if (!stream || stream.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized' });
    }
    if (stream.status !== 'ended') {
      await prisma.liveStream.update({
        where: { id },
        data: { status: 'ended', endedAt: new Date(), viewerCount: 0 },
      });
    }
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
