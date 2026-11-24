import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("securityHeaders", () => {
  const origins = ["https://media.example.com", "http://localhost:8333"];

  it("allows each image origin in img-src", () => {
    const csp = securityHeaders({ imageOrigins: origins, development: false })[
      "Content-Security-Policy"
    ];
    expect(csp).toContain("img-src 'self' data: https://media.example.com http://localhost:8333;");
  });

  it("matches the production policy exactly", () => {
    expect(securityHeaders({ imageOrigins: [], development: false })).toEqual({
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; " +
        "base-uri 'self'; form-action 'self'; object-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("has the dev-only directives in development and not in production", () => {
    const dev = securityHeaders({ imageOrigins: [], development: true })["Content-Security-Policy"];
    const prod = securityHeaders({ imageOrigins: [], development: false })[
      "Content-Security-Policy"
    ];
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("connect-src 'self' ws:");
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toContain("ws:");
  });
});
