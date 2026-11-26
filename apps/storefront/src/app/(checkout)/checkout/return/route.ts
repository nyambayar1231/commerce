import { connection } from "next/server";
import { settlePaymentReturn } from "@/checkout/return";
import { getEnv } from "@/lib/env";

// Where a payment gateway sends the shopper back (`returnUrl`, ADR-0016). A route handler, not a
// page: it may clear the checkout cookie and always answers with a redirect (303, so a reload
// never re-posts anything). Never cached: it reads the shopper's cookie.
export async function GET(): Promise<Response> {
  await connection();
  const destination = await settlePaymentReturn();
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL(destination, getEnv().storefrontUrl).toString(),
      "cache-control": "no-store",
    },
  });
}
