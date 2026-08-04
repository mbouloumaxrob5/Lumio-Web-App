import { NextResponse } from 'next/server';
import { subscribeToUserEvents } from '../../../../lib/sse';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const stream = new ReadableStream({
      start(controller) {
        // send a ping/comment to establish
        controller.enqueue(encodeEvent({ event: 'connected', data: { message: 'connected' } }));

        const handler = (payload: any) => {
          controller.enqueue(encodeEvent({ event: 'notification', data: payload }));
        };

        // subscribe
        const unsubscribe = subscribeToUserEvents(userId, handler);

        // ping every 30s to keep alive
        const id = setInterval(() => controller.enqueue(encodeEvent({ event: 'ping', data: { t: Date.now() } })), 30000);

        // cleanup
        (controller as any).oncancel = () => {
          unsubscribe();
          clearInterval(id);
        };
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (err) {
    console.error('SSE stream error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function encodeEvent({ event, data }: { event: string; data: any }) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}
