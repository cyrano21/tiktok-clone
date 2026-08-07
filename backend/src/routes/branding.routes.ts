import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TENANT_RE = /^[a-zA-Z0-9_-]{1,40}$/;

function parseTenant(raw: unknown): string {
  if (typeof raw !== 'string' || !TENANT_RE.test(raw)) return 'default';
  return raw;
}

export async function brandingRoutes(app: FastifyInstance) {
  // Public: anyone can read the tenant branding (white-label = per-client identity).
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenant = parseTenant((req.query as { tenant?: string }).tenant);
    let branding = await prisma.branding.findUnique({ where: { tenant } });
    if (!branding) {
      branding = await prisma.branding.upsert({
        where: { tenant },
        create: { tenant },
        update: {},
      });
    }
    return reply.send({
      branding: {
        name: branding.name,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        tagline: branding.tagline,
        supportEmail: branding.supportEmail,
        tenant: branding.tenant,
      },
    });
  });

  // Admin: update the tenant branding (tenant isolation: non-default tenants require admin role).
  app.put('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const tenant = parseTenant((req.query as { tenant?: string }).tenant);
    const body = (req.body ?? {}) as {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      tagline?: string;
      supportEmail?: string;
    };

    if (body.primaryColor && !COLOR_RE.test(body.primaryColor)) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'primaryColor must be a hex color (#RRGGBB)' });
    }
    if (body.accentColor && !COLOR_RE.test(body.accentColor)) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'accentColor must be a hex color (#RRGGBB)' });
    }
    if (body.name && body.name.trim().length > 40) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'name too long (max 40 chars)' });
    }

    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (admin?.role !== 'admin' && admin?.role !== 'moderator') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized for this tenant' });
    }

    const branding = await prisma.branding.upsert({
      where: { tenant },
      create: {
        tenant,
        name: body.name ?? 'ORKY',
        logoUrl: body.logoUrl ?? '/logo_orky.png',
        primaryColor: body.primaryColor ?? '#7C3AED',
        accentColor: body.accentColor ?? '#F72585',
        tagline: body.tagline ?? 'La vidéo qui vous ressemble',
        supportEmail: body.supportEmail ?? null,
      },
      update: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {}),
        ...(body.accentColor !== undefined ? { accentColor: body.accentColor } : {}),
        ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
        ...(body.supportEmail !== undefined ? { supportEmail: body.supportEmail } : {}),
      },
    });

    return reply.send({ branding });
  });

  // Admin: reset to the default ORKY identity.
  app.delete('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const tenant = parseTenant((req.query as { tenant?: string }).tenant);
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (admin?.role !== 'admin' && admin?.role !== 'moderator') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not authorized for this tenant' });
    }
    const branding = await prisma.branding.upsert({
      where: { tenant },
      create: { tenant },
      update: {
        name: 'ORKY',
        logoUrl: '/logo_orky.png',
        primaryColor: '#7C3AED',
        accentColor: '#F72585',
        tagline: 'La vidéo qui vous ressemble',
        supportEmail: null,
      },
    });
    return reply.send({ branding, message: 'Branding reset to default' });
  });
}
