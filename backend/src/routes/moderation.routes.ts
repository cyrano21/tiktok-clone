import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, moderatorMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

const targetTypeSchema = z.enum(['user', 'video', 'comment', 'message', 'live']);
const reportCategorySchema = z.enum([
  'spam',
  'harassment',
  'hate',
  'violence',
  'sexual_content',
  'minor_safety',
  'self_harm',
  'illegal',
  'copyright',
  'impersonation',
  'privacy',
  'misinformation',
  'other',
]);

const reportSchema = z.object({
  targetType: targetTypeSchema,
  targetId: z.string().uuid(),
  category: reportCategorySchema,
  reason: z.string().trim().max(2000).optional(),
});

const actionSchema = z.object({
  action: z.enum(['no_action', 'warn', 'suspend_user', 'ban_user', 'remove_content']),
  note: z.string().trim().max(4000).optional(),
  durationHours: z.number().int().min(1).max(24 * 365).optional(),
});

const appealSchema = z.object({
  moderationActionId: z.string().uuid(),
  reason: z.string().trim().min(10).max(4000),
});

const appealDecisionSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  note: z.string().trim().max(4000).optional(),
});

type TargetType = z.infer<typeof targetTypeSchema>;
type TransactionClient = Prisma.TransactionClient;

const PRIORITY_BY_CATEGORY: Record<z.infer<typeof reportCategorySchema>, number> = {
  minor_safety: 100,
  self_harm: 90,
  violence: 80,
  illegal: 75,
  hate: 70,
  sexual_content: 65,
  privacy: 60,
  harassment: 50,
  impersonation: 45,
  misinformation: 35,
  copyright: 30,
  spam: 20,
  other: 10,
};

async function findTargetOwner(client: typeof prisma | TransactionClient, targetType: TargetType, targetId: string) {
  switch (targetType) {
    case 'user': {
      const user = await client.user.findUnique({ where: { id: targetId }, select: { id: true } });
      return user?.id ?? null;
    }
    case 'video': {
      const video = await client.video.findUnique({ where: { id: targetId }, select: { userId: true } });
      return video?.userId ?? null;
    }
    case 'comment': {
      const comment = await client.comment.findUnique({ where: { id: targetId }, select: { userId: true } });
      return comment?.userId ?? null;
    }
    case 'message': {
      const message = await client.message.findUnique({ where: { id: targetId }, select: { senderId: true } });
      return message?.senderId ?? null;
    }
    case 'live': {
      const live = await client.liveStream.findUnique({ where: { id: targetId }, select: { userId: true } });
      return live?.userId ?? null;
    }
  }
}

async function canUserReportTarget(userId: string, targetType: TargetType, targetId: string) {
  if (targetType === 'message') {
    const message = await prisma.message.findUnique({
      where: { id: targetId },
      include: { conversation: { select: { participant1Id: true, participant2Id: true } } },
    });
    if (!message) return false;
    return message.conversation.participant1Id === userId || message.conversation.participant2Id === userId;
  }

  const ownerId = await findTargetOwner(prisma, targetType, targetId);
  if (!ownerId) return false;
  if (targetType === 'user' && ownerId === userId) return false;
  return true;
}

async function applyAction(
  tx: TransactionClient,
  targetType: TargetType,
  targetId: string,
  action: z.infer<typeof actionSchema>['action'],
  durationHours?: number,
) {
  const ownerId = await findTargetOwner(tx, targetType, targetId);
  if (!ownerId) throw new Error('Moderation target no longer exists');

  let expiresAt: Date | null = null;
  let metadata: Prisma.InputJsonValue | undefined;

  if (action === 'warn') {
    await tx.user.update({ where: { id: ownerId }, data: { moderationStrikes: { increment: 1 } } });
  }

  if (action === 'suspend_user') {
    expiresAt = new Date(Date.now() + (durationHours ?? 24) * 60 * 60 * 1000);
    await tx.user.update({
      where: { id: ownerId },
      data: { suspendedUntil: expiresAt, moderationStrikes: { increment: 1 } },
    });
  }

  if (action === 'ban_user') {
    await tx.user.update({
      where: { id: ownerId },
      data: { isBanned: true, suspendedUntil: null, moderationStrikes: { increment: 1 } },
    });
  }

  if (action === 'remove_content') {
    if (targetType === 'video') {
      const current = await tx.video.findUnique({ where: { id: targetId }, select: { visibility: true } });
      metadata = { previousVisibility: current?.visibility ?? 'public' };
      await tx.video.update({ where: { id: targetId }, data: { visibility: 'moderated' } });
    } else if (targetType === 'comment') {
      const current = await tx.comment.findUnique({ where: { id: targetId }, select: { isRemoved: true } });
      metadata = { previousIsRemoved: current?.isRemoved ?? false };
      await tx.comment.update({ where: { id: targetId }, data: { isRemoved: true } });
    } else if (targetType === 'live') {
      const current = await tx.liveStream.findUnique({ where: { id: targetId }, select: { status: true, endedAt: true } });
      metadata = {
        previousStatus: current?.status ?? 'live',
        previousEndedAt: current?.endedAt?.toISOString() ?? null,
      };
      await tx.liveStream.update({ where: { id: targetId }, data: { status: 'ended', endedAt: new Date() } });
    } else {
      throw new Error('remove_content is supported only for video, comment, and live targets');
    }
  }

  return { ownerId, expiresAt, metadata };
}

async function reverseAction(tx: TransactionClient, action: {
  action: string;
  targetType: string;
  targetId: string;
  metadata: Prisma.JsonValue | null;
}) {
  const targetType = targetTypeSchema.parse(action.targetType);
  const ownerId = await findTargetOwner(tx, targetType, action.targetId);
  if (!ownerId) return;

  if (action.action === 'warn') {
    const user = await tx.user.findUnique({ where: { id: ownerId }, select: { moderationStrikes: true } });
    if (user && user.moderationStrikes > 0) {
      await tx.user.update({ where: { id: ownerId }, data: { moderationStrikes: { decrement: 1 } } });
    }
  } else if (action.action === 'suspend_user') {
    await tx.user.update({ where: { id: ownerId }, data: { suspendedUntil: null } });
  } else if (action.action === 'ban_user') {
    await tx.user.update({ where: { id: ownerId }, data: { isBanned: false } });
  } else if (action.action === 'remove_content') {
    const metadata = (action.metadata ?? {}) as Record<string, unknown>;
    if (targetType === 'video') {
      await tx.video.update({
        where: { id: action.targetId },
        data: { visibility: typeof metadata.previousVisibility === 'string' ? metadata.previousVisibility : 'public' },
      });
    } else if (targetType === 'comment') {
      await tx.comment.update({
        where: { id: action.targetId },
        data: { isRemoved: metadata.previousIsRemoved === true },
      });
    } else if (targetType === 'live') {
      await tx.liveStream.update({
        where: { id: action.targetId },
        data: {
          status: typeof metadata.previousStatus === 'string' ? metadata.previousStatus : 'ended',
          endedAt: typeof metadata.previousEndedAt === 'string' ? new Date(metadata.previousEndedAt) : null,
        },
      });
    }
  }
}

export async function moderationRoutes(app: FastifyInstance) {
  app.post('/reports', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const body = reportSchema.parse(req.body);

    if (!(await canUserReportTarget(userId, body.targetType, body.targetId))) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Reportable target not found' });
    }

    const existing = await prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: body.targetType,
        targetId: body.targetId,
        status: { in: ['pending', 'reviewing'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return reply.send({ report: existing, duplicate: true });

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        targetType: body.targetType,
        targetId: body.targetId,
        category: body.category,
        reason: body.reason,
        priority: PRIORITY_BY_CATEGORY[body.category],
      },
    });
    return reply.status(201).send({ report });
  });

  app.get('/reports/mine', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const reports = await prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ reports });
  });

  app.post('/blocks/:userId', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const blockerId = (req as any).userId as string;
    const { userId: blockedId } = z.object({ userId: z.string().uuid() }).parse(req.params);
    if (blockerId === blockedId) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Cannot block yourself' });
    }

    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });

    await prisma.$transaction([
      prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      }),
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId },
          ],
        },
      }),
    ]);

    return reply.send({ blocked: true });
  });

  app.delete('/blocks/:userId', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const blockerId = (req as any).userId as string;
    const { userId: blockedId } = z.object({ userId: z.string().uuid() }).parse(req.params);
    await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return reply.send({ blocked: false });
  });

  app.get('/blocks', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const blockerId = (req as any).userId as string;
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      },
    });
    return reply.send({ blocks });
  });

  app.post('/appeals', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const body = appealSchema.parse(req.body);
    const moderationAction = await prisma.moderationAction.findUnique({ where: { id: body.moderationActionId } });
    if (!moderationAction) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Moderation action not found' });

    const targetType = targetTypeSchema.parse(moderationAction.targetType);
    const ownerId = await findTargetOwner(prisma, targetType, moderationAction.targetId);
    if (ownerId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'This moderation action does not belong to you' });
    }

    const existing = await prisma.appeal.findUnique({
      where: { userId_moderationActionId: { userId, moderationActionId: body.moderationActionId } },
    });
    if (existing) return reply.send({ appeal: existing, duplicate: true });

    const appeal = await prisma.appeal.create({
      data: { userId, moderationActionId: body.moderationActionId, reason: body.reason },
    });
    return reply.status(201).send({ appeal });
  });

  app.get('/appeals/mine', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const appeals = await prisma.appeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { moderationAction: true },
    });
    return reply.send({ appeals });
  });

  app.get('/queue', { preHandler: moderatorMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      status: z.enum(['pending', 'reviewing', 'actioned', 'dismissed']).optional(),
      targetType: targetTypeSchema.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).parse(req.query);

    const reports = await prisma.report.findMany({
      where: {
        ...(query.status ? { status: query.status } : { status: { in: ['pending', 'reviewing'] } }),
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: query.limit,
      include: {
        reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    return reply.send({ reports });
  });

  app.post('/reports/:id/action', { preHandler: moderatorMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const moderatorId = (req as any).userId as string;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = actionSchema.parse(req.body);
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Report not found' });
    if (report.status === 'actioned' || report.status === 'dismissed') {
      return reply.status(409).send({ error: 'ALREADY_RESOLVED', message: 'Report already resolved' });
    }

    const targetType = targetTypeSchema.parse(report.targetType);
    try {
      const result = await prisma.$transaction(async (tx) => {
        const applied = body.action === 'no_action'
          ? { ownerId: await findTargetOwner(tx, targetType, report.targetId), expiresAt: null, metadata: undefined }
          : await applyAction(tx, targetType, report.targetId, body.action, body.durationHours);

        const moderationAction = await tx.moderationAction.create({
          data: {
            moderatorId,
            targetType,
            targetId: report.targetId,
            action: body.action,
            reason: body.note ?? report.reason,
            expiresAt: applied.expiresAt,
            metadata: applied.metadata,
          },
        });

        const updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: body.action === 'no_action' ? 'dismissed' : 'actioned',
            resolution: body.action,
            actionNote: body.note,
            assignedToId: moderatorId,
            resolvedAt: new Date(),
          },
        });

        return { moderationAction, report: updatedReport };
      });
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Moderation action failed';
      return reply.status(400).send({ error: 'MODERATION_ACTION_FAILED', message });
    }
  });

  app.get('/appeals', { preHandler: moderatorMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      status: z.enum(['pending', 'accepted', 'rejected']).default('pending'),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).parse(req.query);
    const appeals = await prisma.appeal.findMany({
      where: { status: query.status },
      orderBy: { createdAt: 'asc' },
      take: query.limit,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        moderationAction: true,
      },
    });
    return reply.send({ appeals });
  });

  app.post('/appeals/:id/resolve', { preHandler: moderatorMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const reviewerId = (req as any).userId as string;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = appealDecisionSchema.parse(req.body);
    const appeal = await prisma.appeal.findUnique({
      where: { id },
      include: { moderationAction: true },
    });
    if (!appeal) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Appeal not found' });
    if (appeal.status !== 'pending') {
      return reply.status(409).send({ error: 'ALREADY_RESOLVED', message: 'Appeal already resolved' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.decision === 'accepted') {
        await reverseAction(tx, appeal.moderationAction);
      }
      return tx.appeal.update({
        where: { id },
        data: {
          status: body.decision,
          reviewerId,
          decisionNote: body.note,
          resolvedAt: new Date(),
        },
      });
    });

    return reply.send({ appeal: updated });
  });
}
