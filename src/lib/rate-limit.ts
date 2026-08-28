// Simple in-memory rate limiter — par instance (suffit pour Vercel serverless à l'échelle, à remplacer par Redis si millions/jour)
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (b.count >= max) {
    return { ok: false, retryAfterMs: b.resetAt - now }
  }
  b.count += 1
  return { ok: true }
}

export function getClientKey(req: Request): string {
  const h = (name: string) => (req.headers as any).get?.(name) || ''
  const ip = h('x-forwarded-for')?.split(',')[0]?.trim() || h('x-real-ip') || 'unknown'
  return ip
}
