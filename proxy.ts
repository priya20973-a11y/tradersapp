/**
 * Next.js Middleware — edge-safe coarse routing, tracing, and dynamic CSP nonce injection.
 *
 * Responsibilities (coarse layer only — NOT the sole auth layer):
 *  1. Inject cryptographically random nonce and Content-Security-Policy header.
 *  2. Inject request-ID header for tracing.
 *  3. Reject unauthenticated requests to protected routes → redirect to /signin.
 *  4. Redirect authenticated users away from public auth pages → redirect to /.
 *  5. Coarse role-prefix guard: /admin/* requires Super Admin.
 *
 * Fine-grained current role, authzVersion, and permission enforcement strictly live server-side in requirePermission().
 */

import { randomUUID } from "node:crypto";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that do not require authentication. */
const PUBLIC_PATHS = new Set(["/signin", "/signup", "/admin/login", "/api/health", "/api/signup"]);

/** Route prefixes that require Super Admin role. */
const ADMIN_ONLY_PREFIXES = ["/admin/organizations", "/api/admin"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Allow NextAuth internal API
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

function isSuperAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function withSecurityHeaders(response: NextResponse, cspHeader: string, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("x-nonce", nonce);
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const pathname = request.nextUrl.pathname;

  // --- 1. Dynamic CSP Nonce generation ---
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // Build strong Content Security Policy with nonce
  const cspHeader = [
    "default-src 'self'",
    // In dev, Next.js / React Fast Refresh / Turbopack needs 'unsafe-eval'
    // With 'strict-dynamic' and 'nonce-...', modern browsers ignore 'unsafe-inline' and trust scripts loaded by nonced scripts.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline'`,
    // Styles: Tailwind, Next.js styles, Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' blob: data:",
    // Connect-src: in dev, Turbopack and Fast Refresh use WebSockets (ws: wss:)
    `connect-src 'self' ${isDev ? "ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  // Attach headers for downstream Server Components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[proxy] NEXTAUTH_SECRET is not configured. Authentication is disabled.");
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Server misconfiguration: authentication is not available." },
        { status: 503 },
      ),
      cspHeader,
      nonce,
    );
  }

  // --- 2. Parse JWT token (edge-safe, no DB call) ---
  const token = await getToken({ req: request, secret });

  // --- 3. Public path: skip auth but redirect authenticated users away from auth pages ---
  if (isPublicPath(pathname)) {
    if (token && (pathname === "/signin" || pathname === "/signup" || pathname === "/admin/login")) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)), cspHeader, nonce);
    }
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      cspHeader,
      nonce,
    );
  }

  // --- 4. Unauthenticated → redirect to /signin ---
  if (!token) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return withSecurityHeaders(NextResponse.redirect(signInUrl), cspHeader, nonce);
  }

  // --- Fast edge redirect for module aliases to eliminate server-component redirect waterfall ---
  if (pathname === "/sales" || pathname === "/customers") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/sales/customers", request.url)), cspHeader, nonce);
  }
  if (pathname === "/marketplace") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/marketplace/traders", request.url)), cspHeader, nonce);
  }
  if (pathname === "/invoices") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/sales/invoices", request.url)), cspHeader, nonce);
  }

  // --- 5. Coarse role-prefix guard for admin-only routes ---
  // Notice: Proxy checks are coarse edge-layer filters only. Do NOT rely on token.role alone
  // for admin authorization. Fine-grained current role, authzVersion, and permissions are
  // strictly validated and enforced server-side via requirePermission().
  if (isSuperAdminOnly(pathname) && token.id !== "admin" && token.role !== "Super Admin") {
    console.warn(
      `[proxy] Coarse block for "${pathname}" (user: "${token.email ?? token.id ?? 'unknown'}", token role: ${token.role})`,
    );
    // Return 403 for API routes, redirect to / for UI routes
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
        cspHeader,
        nonce,
      );
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)), cspHeader, nonce);
  }

  // --- 6. Pass through with request-ID and CSP headers ---
  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    cspHeader,
    nonce,
  );
}

export const config = {
  /**
   * Match all routes EXCEPT:
   *  - Next.js internals (_next/static, _next/image)
   *  - Static files (favicon, fonts, images, etc.)
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|eot|css|js)$).*)",
  ],
};
