// Fixed-window in-memory rate limiting. Per-instance only, which is fine for the single app instance.
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Counts one attempt for `key`; returns false once more than `max` attempts happen within `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Client IP as reported by the DigitalOcean / reverse proxy in front of the app. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("do-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function tooManyRequests(): Response {
  return new Response(JSON.stringify({ error: "Too many attempts. Please wait a few minutes and try again." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "900" },
  });
}
