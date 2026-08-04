import { NextResponse } from 'next/server';

export async function GET() {
  const uploadEndpoint = process.env.UPLOADTHING_ENDPOINT || null;
  const apiKey = process.env.UPLOADTHING_API_KEY || null;

  if (!uploadEndpoint || !apiKey) {
    return NextResponse.json({ ok: false, message: 'Uploadthing not configured. Falling back to server upload.' });
  }

  // Return the endpoint and required headers; client will POST multipart/form-data directly.
  return NextResponse.json({ ok: true, uploadUrl: uploadEndpoint, headers: { 'x-api-key': apiKey } });
}
