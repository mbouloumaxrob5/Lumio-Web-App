import Redis from 'ioredis';
import EventEmitter from 'events';

const REDIS_URL = process.env.REDIS_URL || null;

let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

if (REDIS_URL) {
  redisPub = new Redis(REDIS_URL);
  redisSub = new Redis(REDIS_URL);
}

declare global {
  // eslint-disable-next-line no-var
  var _lumio_sse_emitter: EventEmitter | undefined;
}

const emitter: EventEmitter = global._lumio_sse_emitter ?? new EventEmitter();
if (!global._lumio_sse_emitter) global._lumio_sse_emitter = emitter;

export async function sendNotificationEvent(userId: string, payload: any) {
  if (redisPub) {
    try {
      await redisPub.publish(`notifications:${userId}`, JSON.stringify(payload));
      return;
    } catch (e) {
      console.warn('Redis publish failed, falling back to in-memory', e?.message || e);
    }
  }
  emitter.emit(userId, payload);
}

export function subscribeToUserEvents(userId: string, handler: (payload: any) => void) {
  if (redisSub) {
    // subscribe channel
    const ch = `notifications:${userId}`;
    const messageHandler = (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        handler(data);
      } catch (e) {
        console.warn('Failed to parse redis message', e);
      }
    };
    redisSub.subscribe(ch).then(() => redisSub!.on('message', messageHandler));
    return () => {
      try { redisSub!.unsubscribe(ch); redisSub!.off('message', messageHandler); } catch (e) {}
    };
  }

  emitter.on(userId, handler);
  return () => emitter.off(userId, handler);
}
