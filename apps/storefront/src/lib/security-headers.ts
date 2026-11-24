// Response headers for every document (ARCHITECTURE §10.13). A pure function of the configuration
// so it can be unit-tested; src/proxy.ts applies it. HSTS is set by Caddy, not here.

export type SecurityHeadersConfig = {
  /** Origins allowed in img-src besides 'self' (IMAGE_ORIGINS). */
  imageOrigins: string[];
  /** `next dev` needs eval and a websocket for hot reload; production gets neither. */
  development: boolean;
};

export function contentSecurityPolicy({
  imageOrigins,
  development,
}: SecurityHeadersConfig): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Inline scripts and styles because per-request nonces would make every page dynamic.
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", ...imageOrigins],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(development ? ["ws:"] : [])],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(config: SecurityHeadersConfig): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(config),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}
