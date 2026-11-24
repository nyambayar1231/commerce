import { connection } from "next/server";

// Liveness for the container health check (ARCHITECTURE §10.15). Read at request time, never
// prerendered into the build.
export async function GET() {
  await connection();
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
