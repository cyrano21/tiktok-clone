import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-change-me');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-refresh-change-me');
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET are required in production');
}
const ACCESS_SECRET: string = JWT_SECRET;
const REFRESH_SECRET: string = JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

function accountRestriction(user: { isBanned: boolean; suspendedUntil: Date | null }) {
  if (user.isBanned) return { status: 403, error: 'ACCOUNT_BANNED', message: 'Account banned' };
  if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
    return { status: 403, error: 'ACCOUNT_SUSPENDED', message: 'Account temporarily suspended', suspendedUntil: user.suspendedUntil };
  }
  return null;
}

export class AuthController {
  static async register(req: FastifyRequest, reply: FastifyReply) {
    const { email, username, password, displayName } = z.object({
      email: z.string().email().max(254),
      username: z.string().regex(/^[a-zA-Z0-9_.-]{3,32}$/),
      password: z.string().min(8).max(128),
      displayName: z.string().trim().max(50).optional(),
    }).parse(req.body);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
    });
    if (existingUser) {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash: hashedPassword,
        displayName: displayName?.trim() || normalizedUsername,
      },
    });

    const tokens = generateTokens(user.id);
    await redis.set(`refresh:${user.id}`, tokens.refreshToken, { EX: 7 * 24 * 60 * 60 });
    return reply.status(201).send({
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
      ...tokens,
    });
  }

  static async login(req: FastifyRequest, reply: FastifyReply) {
    const { email, password } = z.object({
      email: z.string().trim().min(1).max(254),
      password: z.string().min(1).max(128),
    }).parse(req.body);
    const identifier = email.trim();

    const user = await prisma.user.findFirst({
      where: identifier.includes('@')
        ? { email: identifier.toLowerCase() }
        : { username: identifier },
    });
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });

    const restriction = accountRestriction(user);
    if (restriction) return reply.status(restriction.status).send(restriction);

    const tokens = generateTokens(user.id);
    await redis.set(`refresh:${user.id}`, tokens.refreshToken, { EX: 7 * 24 * 60 * 60 });
    return reply.send({
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
      ...tokens,
    });
  }

  static async refresh(req: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1).max(4096) }).parse(req.body);

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as unknown as { userId: string };
      const [storedToken, user] = await Promise.all([
        redis.get(`refresh:${decoded.userId}`),
        prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, isBanned: true, suspendedUntil: true },
        }),
      ]);

      if (storedToken !== refreshToken || !user) {
        return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid refresh token' });
      }
      const restriction = accountRestriction(user);
      if (restriction) {
        await redis.del(`refresh:${decoded.userId}`);
        return reply.status(restriction.status).send(restriction);
      }

      const tokens = generateTokens(decoded.userId);
      await redis.set(`refresh:${decoded.userId}`, tokens.refreshToken, { EX: 7 * 24 * 60 * 60 });
      return reply.send(tokens);
    } catch {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
    }
  }

  static async logout(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId;
    await redis.del(`refresh:${userId}`);
    return reply.send({ message: 'Logged out successfully' });
  }

  static async updateProfile(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId;
    const body = z.object({
      displayName: z.string().trim().max(50).optional(),
      bio: z.string().trim().max(200).optional(),
      avatarUrl: z.string().trim().max(500).optional(),
      website: z.string().trim().max(200).optional(),
    }).strict().parse(req.body ?? {});

    const data: Record<string, string | null | undefined> = {};
    if (body.displayName !== undefined) data.displayName = body.displayName;
    if (body.bio !== undefined) data.bio = body.bio;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl || null;
    if (body.website !== undefined) data.website = body.website || null;

    const user = await prisma.user.update({
      where: { id: userId },
      data: data as any,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, videos: true } },
      },
    });
    return reply.send({ user });
  }

  static async me(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        role: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, videos: true } },
      },
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    return reply.send({ user });
  }
}
