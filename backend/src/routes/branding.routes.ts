import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TENANT_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const DEFAULT_BRANDING = {
  name: 'ORKY',
  logoUrl: '/logo_orky.png',
  primaryColor: '#7C3AED',
  accentColor: '#F72585',
  tagline: 'La vidéo qui vous ressemble',
  supportEmail: null as string | null,
  tenant: 'default',
};

function parseTenant(raw: unknown): string {
  if (typeof raw !== 'string' || !TENANT_RE.test(raw)) return 'default';
  return raw;
}

async function requireBrandingAdmin(userId: string, reply: FastifyReply) {
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (admin?.role !== 'admin' && admin?.role !== 'moderator') {
    reply.status(403).send({ error: 'FORBIDDEN', message: 'Branding administration requires an admin role' });
    return false;
  }
  return true;
}

export async function brandingRoutes(app: FastifyInstance) {
  // Public reads are side-effect free. Unknown tenant names never manufacture
  // database rows merely by being requested.
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenant = parseTenant((req.query as { tenant?: string }).tenant);
    const branding = await prisma.branding.findUnique({ where: { tenant } });
    if (!branding) {
      if (tenant === 'default') return reply.send({ branding: DEFAULT_BRANDING });
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Branding tenant not found' });
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

  // Admin-managed branding only. This is not customer-owned multi-tenancy.
  app.put('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    if (!(await requireBrandingAdmin(userId, reply))) return;
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

    const branding = await prisma.branding.upsert({
      where: { tenant },
      create: {
        tenant,
        name: body.name ?? DEFAULT_BRANDING.name,
        logoUrl: body.logoUrl ?? DEFAULT_BRANDING.logoUrl,
        primaryColor: body.primaryColor ?? DEFAULT_BRANDING.primaryColor,
        accentColor: body.accentColor ?? DEFAULT_BRANDING.accentColor,
        tagline: body.tagline ?? DEFAULT_BRANDING.tagline,
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

  app.delete('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    if (!(await requireBrandingAdmin(userId, reply))) return;
    const tenant = parseTenant((req.query as { tenant?: string }).tenant);
    const branding = await prisma.branding.upsert({
      where: { tenant },
      create: { tenant },
      update: {
        name: DEFAULT_BRANDING.name,
        logoUrl: DEFAULT_BRANDING.logoUrl,
        primaryColor: DEFAULT_BRANDING.primaryColor,
        accentColor: DEFAULT_BRANDING.accentColor,
        tagline: DEFAULT_BRANDING.tagline,
        supportEmail: null,
      },
    });
    return reply.send({ branding, message: 'Branding reset to default' });
  });
}
