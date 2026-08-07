import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
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

function createLiveKitToken(input: {
  userId: string;
  username: string;
  roomName: string;
  canPublish: boolean;
}) {
  const { apiKey, apiSecret } = requireLiveKitConfig();
  const videoGrant: Record<string, unknown> = {
    room: input.roomName,
    roomJoin: true,
    canPublish: input.canPublish,
    canSubscribe: true,
    canPublishData: true,
  };

  if (input.canPublish) {
    videoGrant.canPublishSources = ['camera', 'microphone', 'screen_share', 'screen_share_audio'];
  }

  // LiveKit access tokens are HS256 JWTs whose issuer is the API key and whose
  // `video` grant scopes the participant to one room. The API secret never
  // leaves this backend.
  return jwt.sign(
    {
      name: input.username,
      metadata: JSON.stringify({ userId: input.userId, role: input.canPublish ? 'host' : 'viewer' }),
      video: videoGrant,
    },
    apiSecret,
    {
      algorithm: 'HS256',
      issuer: apiKey,
      subject: input.userId,
      expiresIn: '10m',
    },
  );
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

export async function liveRoutes(app: FastifyInstance) {
  app.get('/config/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = liveKitConfig();
    return reply.send({
      configured: Boolean(config),
      serverUrl: config?.serverUrl ?? null,
    });
  });

  app.post('/start', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const username = (req as any).username as string;
    const { title } = startSchema.parse(req.body);
    const config = requireLiveKitConfig();

    // A user cannot advertise several simultaneous lives. Stale DB sessions are
    // closed before the new room is published.
    await prisma.liveStream.updateMany({
      where: { userId, status: 'live' },
      data: { status: 'ended', endedAt: new Date() },
    });

    const roomName = `live_${randomUUID()}`;
    const stream = await prisma.liveStream.create({
      data: {
        userId,
        title,
        status: 'live',
        // Kept in the existing column for backwards compatibility. It is now a
        // room identifier, not a secret publishing credential.
        streamKey: roomName,
      },
      include: { user: { select: publicUserSelect } },
    });

    const token = createLiveKitToken({ userId, username, roomName, canPublish: true });
    return reply.status(201).send({
      stream,
      connection: {
        serverUrl: config.serverUrl,
        roomName,
        token,
        role: 'host',
      },
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
    const token = createLiveKitToken({
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
    return reply.send({ stream });
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

    // Do not expose the internal LiveKit room name in public discovery payloads.
    return reply.send({
      streams: streams.map(({ streamKey: _roomName, ...stream }) => stream),
      page,
      limit,
    });
  });
}
