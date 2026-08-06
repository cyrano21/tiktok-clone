import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { registerRoutes } from './routes/index';
import { setupRateLimiter } from './middleware/rateLimiter';

/** Recursively convert BigInt values to numbers so Fastify can serialize payloads.
 *  Date instances pass through untouched (they serialize natively). */
function convertBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(convertBigInts);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = convertBigInts(v);
    }
    return out;
  }
  return value;
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    bodyLimit: 104857600,
  });

  // Prisma returns BigInt for counters (viewCount, likeCount, ...) which Fastify's
  // JSON serializer can't handle. Convert them to numbers before serialization.
  app.addHook('preSerialization', async (_request, _reply, payload) => {
    return convertBigInts(payload);
  });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, { limits: { fileSize: 104857600, files: 1 } });
  await app.register(websocket);
  await setupRateLimiter(app);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  await registerRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: (error as any).errors,
      });
    }
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'INTERNAL_ERROR' : error.name,
      message: process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Internal server error'
        : error.message,
    });
  });

  return app;
}
