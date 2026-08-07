import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET
  ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-change-me');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

type AuthenticatedUser = {
  id: string;
  username: string;
  role: string;
  isBanned: boolean;
  suspendedUntil: Date | null;
};

async function loadActiveUser(userId: string): Promise<AuthenticatedUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      isBanned: true,
      suspendedUntil: true,
    },
  });
}

function attachUser(req: FastifyRequest, user: AuthenticatedUser) {
  (req as any).userId = user.id;
  (req as any).username = user.username;
  (req as any).role = user.role;
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing authentication token' });
  }

  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as { userId: string };
    const user = await loadActiveUser(decoded.userId);

    if (!user) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'User not found' });
    }
    if (user.isBanned) {
      return reply.status(403).send({ error: 'ACCOUNT_BANNED', message: 'Account banned' });
    }
    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
      return reply.status(403).send({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Account temporarily suspended',
        suspendedUntil: user.suspendedUntil,
      });
    }

    attachUser(req, user);
  } catch (err) {
    if (reply.sent) return;
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;

  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as { userId: string };
    const user = await loadActiveUser(decoded.userId);
    if (!user || user.isBanned) return;
    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) return;
    attachUser(req, user);
  } catch {
    // Optional authentication deliberately fails closed to guest mode.
  }
}

export async function moderatorMiddleware(req: FastifyRequest, reply: FastifyReply) {
  await authMiddleware(req, reply);
  if (reply.sent) return;

  const role = (req as any).role as string | undefined;
  if (role !== 'admin' && role !== 'moderator') {
    return reply.status(403).send({ error: 'FORBIDDEN', message: 'Moderator role required' });
  }
}
