import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { AuthController } from '../controllers/auth.controller';

export async function authRoutes(app: FastifyInstance) {
  // Credential endpoints have stricter IP-level limits than the global API
  // budget to slow password guessing and account creation abuse.
  app.post('/register', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, AuthController.register);
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, AuthController.login);
  app.post('/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
  }, AuthController.refresh);

  app.post('/logout', { preHandler: authMiddleware }, AuthController.logout);
  app.get('/me', { preHandler: authMiddleware }, AuthController.me);
  app.patch('/me', { preHandler: authMiddleware }, AuthController.updateProfile);
}
