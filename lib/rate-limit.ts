type RateEntry = { count: number; resetAt: number };

const store = new Map<string, RateEntry>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { remaining: max - 1, resetAt: Date.now() + windowMs };
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

export function getRateInfo(key: string) {
  const entry = store.get(key);
  if (!entry) return { count: 0, resetAt: 0 };
  return { count: entry.count, resetAt: entry.resetAt };
}
