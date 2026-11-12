import { isIP } from "node:net";

// The client's IP address (login throttling PLAN M9.3, thumbnail limit M9.4): the socket's
// address; with `trustProxy` (behind our own reverse proxy, `TRUST_PROXY=true`) the last
// `X-Forwarded-For` entry, the one that proxy added. Earlier entries come from the client and can
// be forged, so they are never used.

/** What node:http gives Yoga per request (`req`); in-process `app.fetch` calls may pass it too. */
export type ServerContext = { req?: { socket?: { remoteAddress?: string } } };

/** The request's client IP (see above), or null when it can't be known. */
export function clientIpOf(
  request: Request,
  req: ServerContext["req"],
  trustProxy: boolean,
): string | null {
  if (trustProxy) {
    const forwarded = (request.headers.get("x-forwarded-for") ?? "").split(",");
    const last = forwarded[forwarded.length - 1]?.trim() ?? "";
    if (isIP(last) !== 0) return last;
  }
  const address = req?.socket?.remoteAddress;
  return address !== undefined && isIP(address) !== 0 ? address : null;
}
