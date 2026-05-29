import 'dotenv/config';
import { buildApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { redis } from './config/redis';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  await connectDatabase();
  await connectRedis();

  const app = await buildApp();

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Graceful shutdown...`);
    await app.close();
    await disconnectDatabase();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  await app.listen({ port: PORT, host: HOST });
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Health: http://${HOST}:${PORT}/health`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
