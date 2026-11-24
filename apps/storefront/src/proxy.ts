import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { securityHeaders } from "@/lib/security-headers";

// Adds the security headers (ARCHITECTURE §10.13) to every page response. Set here, at request
// time, so they follow the runtime configuration (IMAGE_ORIGINS) of the running image.
export default function proxy() {
  const env = getEnv();
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(
    securityHeaders({ imageOrigins: env.imageOrigins, development: !env.production }),
  )) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Not the API routes, Next's own files, or anything with a file extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
