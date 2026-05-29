import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing authentication token' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, isBanned: true },
    });
    if (!user || user.isBanned) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'User not found or banned' });
    }
    (req as any).userId = decoded.userId;
    (req as any).username = user.username;
  } catch (err) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as { userId: string };
      (req as any).userId = decoded.userId;
    } catch {
      // Silent
    }
  }
}
