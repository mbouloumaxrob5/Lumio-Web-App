import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';

let s3Client: S3Client | null = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({ region: S3_REGION });
}

export async function getPresignedPutUrl(key: string, contentType: string, expiresSeconds = 900) {
  if (!s3Client) throw new Error('S3 not configured');
  const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType });
  const url = await getSignedUrl(s3Client, cmd, { expiresIn: expiresSeconds });
  const publicUrl = process.env.S3_PUBLIC_URL || `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${encodeURIComponent(key)}`;
  return { url, publicUrl };
}

export async function getS3ObjectBuffer(key: string) {
  if (!s3Client) throw new Error('S3 not configured');
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const res = await s3Client.send(cmd);
  const body = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
