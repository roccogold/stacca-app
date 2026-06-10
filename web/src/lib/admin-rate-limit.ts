import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/** Shared admin rate-limit gate. Returns a 429 response, or null when allowed. */
export function adminRateLimited(req: Request): NextResponse | null {
  const rl = checkRateLimit(
    rateLimitKey(req, "admin"),
    RATE_LIMITS.admin.limit,
    RATE_LIMITS.admin.windowMs,
  );
  if (rl.ok) return null;
  return NextResponse.json(
    { error: "Troppe richieste. Riprova tra poco." },
    { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
  );
}
