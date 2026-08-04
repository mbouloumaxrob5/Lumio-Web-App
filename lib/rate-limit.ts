import Redis from 'ioredis';

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

// In-memory fallback
const store = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (redis) {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    const ttl = await redis.pttl(redisKey);
    if (count > max) {
      const retryAfter = Math.ceil(ttl / 1000);
      const err: any = new Error('Too Many Requests');
      err.retryAfter = retryAfter;
      throw err;
    }
    const remaining = Math.max(0, max - count);
    return { remaining, resetAt: Date.now() + ttl };
  }

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { remaining: max - 1, resetAt: now + windowMs };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const err: any = new Error('Too Many Requests');
    err.retryAfter = retryAfter;
    throw err;
  }

  entry.count += 1;
  store.set(key, entry);
  return { remaining: max - entry.count, resetAt: entry.resetAt };
}

export async function getRateInfo(key: string) {
  if (redis) {
    const redisKey = `rl:${key}`;
    const count = Number(await redis.get(redisKey) || 0);
    const ttl = await redis.pttl(redisKey);
    return { count, resetAt: ttl > 0 ? Date.now() + ttl : 0 };
  }
  const entry = store.get(key);
  if (!entry) return { count: 0, resetAt: 0 };
  return { count: entry.count, resetAt: entry.resetAt };
}
