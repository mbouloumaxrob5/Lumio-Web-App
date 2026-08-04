import Redis from 'ioredis';

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

// In-memory fallback token-bucket (simple)
const store = new Map<string, { tokens: number; last: number }>();

const DEFAULT_CAPACITY = 10;

async function redisTokenBucket(key: string, capacity: number, windowMs: number, requested = 1) {
  if (!redis) throw new Error('Redis not configured');

  // Lua script: token bucket with fields tokens and last (ms)
  const script = `
    local k = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local windowMs = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])
    if capacity <= 0 then return {err = 'invalid capacity'} end
    -- tokens per ms
    local rate = capacity / windowMs
    local data = redis.call('HMGET', k, 'tokens', 'last')
    local tokens = tonumber(data[1]) or capacity
    local last = tonumber(data[2]) or now
    local delta = math.max(0, now - last)
    local add = delta * rate
    tokens = math.min(capacity, tokens + add)
    if tokens < requested then
      local need = requested - tokens
      local secs = math.ceil((need / rate) / 1000)
      return {0, secs}
    end
    tokens = tokens - requested
    redis.call('HMSET', k, 'tokens', tostring(tokens), 'last', tostring(now))
    redis.call('PEXPIRE', k, tostring(windowMs * 2))
    return {1, math.floor(tokens)}
  `;

  const now = Date.now();
  const res = await redis.eval(script, 1, key, capacity, windowMs, now, requested);
  // res: [1, remaining] or [0, retrySecs]
  return res;
}

export async function rateLimit(key: string, max: number, windowMs: number) {
  const capacity = Math.max(1, max);
  if (redis) {
    try {
      const res: any = await redisTokenBucket(key, capacity, windowMs, 1);
      if (Array.isArray(res) && Number(res[0]) === 1) {
        return { remaining: Number(res[1]), resetAt: Date.now() + windowMs };
      }
      const retryAfter = Number(res[1]) || 60;
      const err: any = new Error('Too Many Requests');
      err.retryAfter = retryAfter;
      throw err;
    } catch (e) {
      // fallback to in-memory if redis script fails
      console.warn('Redis token-bucket failed, falling back to in-memory rate-limit', e?.message || e);
    }
  }

  // in-memory simple bucket: refill when window expires
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.last > windowMs) {
    store.set(key, { tokens: capacity - 1, last: now });
    return { remaining: capacity - 1, resetAt: now + windowMs };
  }
  if (entry.tokens <= 0) {
    const retryAfter = Math.ceil((entry.last + windowMs - now) / 1000);
    const err: any = new Error('Too Many Requests');
    err.retryAfter = retryAfter;
    throw err;
  }
  entry.tokens -= 1;
  store.set(key, entry);
  return { remaining: entry.tokens, resetAt: entry.last + windowMs };
}

export async function getRateInfo(key: string) {
  if (redis) {
    try {
      const redisKey = `rl:${key}`;
      const data = await redis.hgetall(redisKey);
      const tokens = data.tokens ? Number(data.tokens) : 0;
      const last = data.last ? Number(data.last) : 0;
      const resetAt = last ? last + (Number(process.env.UPLOAD_RATE_WINDOW_MS || 3600000)) : 0;
      return { count: tokens, resetAt };
    } catch (e) {
      // fallback
    }
  }
  const entry = store.get(key);
  if (!entry) return { count: 0, resetAt: 0 };
  return { count: entry.tokens, resetAt: entry.last + Number(process.env.UPLOAD_RATE_WINDOW_MS || 3600000) };
}
