import { S3Client } from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT?.trim();
const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(endpoint ? { endpoint } : {}),
  forcePathStyle,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 3,
});

export const S3_BUCKET = process.env.S3_BUCKET || 'orky';

// Public media URLs should normally point at a CDN or public object-storage hostname.
// For local MinIO, set CDN_URL explicitly (for example http://localhost:9000/tiktok-clone-videos).
export const CDN_URL = process.env.CDN_URL
  || (endpoint ? `${endpoint.replace(/\/$/, '')}/${S3_BUCKET}` : `https://${S3_BUCKET}.s3.amazonaws.com`);
