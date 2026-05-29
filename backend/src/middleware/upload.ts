import { FastifyRequest, FastifyReply } from 'fastify';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

export function validateVideoUpload(mimetype: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_VIDEO_TYPES.includes(mimetype)) {
    return { valid: false, error: `Invalid video type: ${mimetype}. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}` };
  }
  if (size > MAX_VIDEO_SIZE) {
    return { valid: false, error: `Video too large: ${(size / 1024 / 1024).toFixed(1)}MB. Max: 100MB` };
  }
  return { valid: true };
}

export function validateImageUpload(mimetype: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    return { valid: false, error: `Invalid image type: ${mimetype}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` };
  }
  if (size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image too large: ${(size / 1024 / 1024).toFixed(1)}MB. Max: 10MB` };
  }
  return { valid: true };
}

export function validateAudioUpload(mimetype: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_AUDIO_TYPES.includes(mimetype)) {
    return { valid: false, error: `Invalid audio type: ${mimetype}. Allowed: ${ALLOWED_AUDIO_TYPES.join(', ')}` };
  }
  if (size > MAX_AUDIO_SIZE) {
    return { valid: false, error: `Audio too large: ${(size / 1024 / 1024).toFixed(1)}MB. Max: 50MB` };
  }
  return { valid: true };
}

export async function uploadValidationMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const contentType = req.headers['content-type'];
  if (!contentType?.includes('multipart/form-data')) {
    return reply.status(400).send({ error: 'INVALID_REQUEST', message: 'Expected multipart/form-data' });
  }
}
