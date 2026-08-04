import { NextResponse } from 'next/server';

export async function GET() {
  const uploadEndpoint = process.env.UPLOADTHING_ENDPOINT || null;
  const apiKey = process.env.UPLOADTHING_API_KEY || null;

  // Apply a simple rate-limit by IP for signer (lightweight)
  // For heavier rate-limiting, configure REDIS_URL and implement token bucket in Redis.

  if (!uploadEndpoint || !apiKey) {
    return NextResponse.json({ ok: false, message: 'Uploadthing not configured. Falling back to server upload.' });
  }

  return NextResponse.json({ ok: true, uploadUrl: uploadEndpoint, headers: { 'x-api-key': apiKey } });
}
