import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 3,
});

export const S3_BUCKET = process.env.S3_BUCKET || 'tiktok-clone';
export const CDN_URL = process.env.CDN_URL || `https://${S3_BUCKET}.s3.amazonaws.com`;
