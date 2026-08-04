import { NextResponse } from 'next/server';
import { getPresignedPutUrl } from '../../../lib/s3';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileName, mimeType } = body || {};
    if (!fileName || !mimeType) return NextResponse.json({ ok: false, error: 'Missing fileName or mimeType' }, { status: 400 });

    // If S3 configured, generate presigned URL
    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const key = `uploads/${Date.now()}-${randomUUID()}-${fileName}`;
      const { url, publicUrl } = await getPresignedPutUrl(key, mimeType, 15 * 60);
      return NextResponse.json({ ok: true, uploadUrl: url, method: 'PUT', objectKey: key, publicUrl });
    }

    // Fallback to existing Uploadthing signer if configured
    const uploadEndpoint = process.env.UPLOADTHING_ENDPOINT || null;
    const apiKey = process.env.UPLOADTHING_API_KEY || null;
    if (!uploadEndpoint || !apiKey) {
      return NextResponse.json({ ok: false, message: 'Upload provider not configured. Use server upload fallback.' });
    }
    return NextResponse.json({ ok: true, uploadUrl: uploadEndpoint, headers: { 'x-api-key': apiKey }, method: 'POST' });
  } catch (err) {
    console.error('Sign route error', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
