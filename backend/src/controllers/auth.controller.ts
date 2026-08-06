import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { redis } from '../config/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

export class AuthController {
  static async register(req: FastifyRequest, reply: FastifyReply) {
    const { email, username, password, displayName } = req.body as any;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existingUser) {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: hashedPassword,
        displayName: displayName || username,
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
    const { email, password } = req.body as any;
    const identifier = String(email ?? '').trim();
    if (!identifier || !password) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Identifier and password are required' });
    }

    // Accepts both email and username ("Email or username" placeholder).
    const user = await prisma.user.findFirst({
      where:
        identifier.includes('@')
          ? { email: identifier }
          : { username: identifier },
    });
    if (!user) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Account is banned' });
    }

    const tokens = generateTokens(user.id);
    await redis.set(`refresh:${user.id}`, tokens.refreshToken, { EX: 7 * 24 * 60 * 60 });

    return reply.send({
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
      ...tokens,
    });
  }

  static async refresh(req: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = req.body as any;

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
      const storedToken = await redis.get(`refresh:${decoded.userId}`);

      if (storedToken !== refreshToken) {
        return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid refresh token' });
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
    const { displayName, bio, avatarUrl, website } = req.body as any;

    const data: Record<string, string | null | undefined> = {};
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.length > 50) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'displayName too long (max 50)' });
      }
      data.displayName = displayName.trim();
    }
    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > 200) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'bio too long (max 200)' });
      }
      data.bio = bio.trim();
    }
    if (avatarUrl !== undefined) {
      if (typeof avatarUrl !== 'string' || avatarUrl.length > 500) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'avatarUrl too long' });
      }
      data.avatarUrl = avatarUrl.trim() || null;
    }
    if (website !== undefined) {
      if (typeof website !== 'string' || website.length > 200) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'website too long' });
      }
      data.website = website.trim() || null;
    }

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
        createdAt: true,
        _count: { select: { followers: true, following: true, videos: true } },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }

    return reply.send({ user });
  }
}
