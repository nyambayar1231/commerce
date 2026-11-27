import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createFakeWire } from "../../apps/api/test/fakeWire.ts";

// Wire for the e2e run (ADR-0016 §10; Wire has no test mode): the fake API on /v1 for the API
// and the worker, and a hosted payment page on /c/<session> for the shopper. "Pay" marks the
// payment paid, sends Wire's signed `payment_intent.succeeded` to the API's webhook, and returns
// the shopper to the shop's success_url — the same journey as on pay.wire.mn.
const port = Number(process.env.FAKE_WIRE_PORT ?? 4099);
const webhookUrl = process.env.FAKE_WIRE_WEBHOOK_URL ?? "http://localhost:4010/webhooks/wire";
const wire = createFakeWire({ checkoutBaseUrl: `http://localhost:${port}` });

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
  }
  return new Request(`http://localhost:${port}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
}

async function send(res: ServerResponse, response: Response) {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const html = (body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake Wire</title></head><body>${body}</body></html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );

/** Delivers a signed notification to the shop's webhook, as Wire does. */
async function notify(event: { body: string; signature: string }) {
  const delivered = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "wirepayment-signature": event.signature },
    body: event.body,
  }).catch(() => null);
  if (!delivered?.ok) console.error(`fake Wire: webhook delivery failed (${delivered?.status})`);
}

async function page(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const match = /^\/c\/(cs_[a-z0-9]+)(\/pay|\/cancel)?$/.exec(url.pathname);
  const session = match ? wire.sessions.get(match[1] ?? "") : undefined;
  if (!match || !session) return new Response("Not found", { status: 404 });
  const intent = wire.intents.get(session.intent);
  if (!intent) return new Response("Not found", { status: 404 });

  if (!match[2]) {
    return html(
      `<main><h1>Wire test payment</h1><p>Amount: ${intent.amount} MNT</p>` +
        `<form method="post" action="${url.pathname}/pay"><button type="submit">Pay with QPay</button></form>` +
        `<form method="post" action="${url.pathname}/cancel"><button type="submit">Cancel</button></form>` +
        "</main>",
    );
  }
  if (match[2] === "/cancel") {
    // The shopper gave up: Wire cancels the payment, notifies the shop, returns to cancel_url.
    wire.expire(intent.id);
    await notify(
      wire.webhook("payment_intent.canceled", {
        id: intent.id,
        object: "payment_intent",
        status: "canceled",
        amount: intent.amount,
        currency: "MNT",
      }),
    );
    return new Response(null, {
      status: 303,
      headers: { location: session.cancelUrl || session.successUrl || "/" },
    });
  }
  // The shopper paid in their bank app: Wire records the charge and notifies the shop.
  const charge = wire.pay(intent.id);
  const event = wire.webhook("payment_intent.succeeded", {
    id: intent.id,
    object: "payment_intent",
    status: "succeeded",
    amount: intent.amount,
    currency: "MNT",
    charge: charge.id,
  });
  await notify(event);
  return new Response(null, { status: 303, headers: { location: session.successUrl || "/" } });
}

createServer(async (req, res) => {
  try {
    const request = await toRequest(req);
    const path = new URL(request.url).pathname;
    if (path === "/health") return send(res, new Response("ok"));
    await send(res, path.startsWith("/v1/") ? await wire.handle(request) : await page(request));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("fake Wire error");
  }
}).listen(port, () => console.log(`Fake Wire on http://localhost:${port}`));
