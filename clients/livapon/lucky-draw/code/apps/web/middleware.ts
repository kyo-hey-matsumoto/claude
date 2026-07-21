import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "./lib/auth/basic-auth";
import { getClientIp } from "./lib/auth/client-ip";
import { createFixedWindowRateLimiter } from "./lib/auth/rate-limiter";
import { PATHNAME_HEADER } from "./lib/pathname-header";

// Module-level singleton: persists for the lifetime of one server/edge
// instance (not distributed across regions/restarts — see rate-limiter.ts).
// 5 wrong passwords per IP per minute is generous for a real visitor who
// mistypes, tight enough to blunt a naive password-guessing loop against the
// single shared pre-launch credential.
const basicAuthLimiter = createFixedWindowRateLimiter({ maxFailures: 5, windowMs: 60_000 });

export function buildForwardedRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return headers;
}

/**
 * Pre-launch site-wide gate: this store already moves real money (Shopify
 * checkout + automatic refunds) while the catalog/branding is still
 * incomplete, so the public URL shouldn't be freely browsable/purchasable
 * before launch. No Vercel plan upgrade needed (Password Protection is a
 * Pro+ feature) — this is a plain HTTP Basic Auth challenge.
 *
 * Controlled by env: unset SITE_BASIC_AUTH_USER/SITE_BASIC_AUTH_PASSWORD to
 * disable entirely (e.g. after the real launch), no code change needed.
 */
export async function middleware(request: NextRequest) {
  const passThroughInit = { request: { headers: buildForwardedRequestHeaders(request) } };

  const user = process.env.SITE_BASIC_AUTH_USER;
  const password = process.env.SITE_BASIC_AUTH_PASSWORD;

  if (!user || !password) {
    return NextResponse.next(passThroughInit);
  }

  const clientIp = getClientIp(request.headers);

  // Blocked IPs are rejected before touching checkBasicAuth at all, so a
  // guessing loop can't keep spending compute on the constant-time compare
  // once it has already burned through its allowance.
  if (basicAuthLimiter.isBlocked(clientIp)) {
    return new NextResponse("Too many attempts. Try again shortly.", { status: 429 });
  }

  if (await checkBasicAuth(request.headers.get("authorization"), user, password)) {
    basicAuthLimiter.recordSuccess(clientIp);
    return NextResponse.next(passThroughInit);
  }

  basicAuthLimiter.recordFailure(clientIp);
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LIVAPON Academy (pre-launch)"' }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
