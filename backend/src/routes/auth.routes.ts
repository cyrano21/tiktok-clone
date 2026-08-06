import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { AuthController } from '../controllers/auth.controller';

export async function authRoutes(app: FastifyInstance) {
  // Public routes
  app.post('/register', AuthController.register);
  app.post('/login', AuthController.login);
  app.post('/refresh', AuthController.refresh);

  // Protected routes
  app.post('/logout', { preHandler: authMiddleware }, AuthController.logout);
  app.get('/me', { preHandler: authMiddleware }, AuthController.me);
  app.patch('/me', { preHandler: authMiddleware }, AuthController.updateProfile);
}
