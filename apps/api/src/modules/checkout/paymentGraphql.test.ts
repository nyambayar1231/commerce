import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient, type GqlResult } from "../../../test/graphql.ts";
import { testGateways } from "../../../test/payments.ts";
import { fromGlobalId, toGlobalId } from "../../graphql/globalId.ts";
import { createFakeGateway, FAKE_GATEWAY_ID } from "../payments/index.ts";
import {
  createShippingMethod,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
  updateCheckoutEmail,
} from "./index.ts";

// transactionInitialize and the checkout's payment fields through the app, anonymously (M5.3).
const db = getDb();
const client = createTestClient(db);
let checkoutId: string;

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE product, checkout CASCADE");
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: `boots-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({ productId: product.id, priceAmount: 1000, currency: "MNT", trackInventory: false })
    .returning();
  if (!variant) throw new Error("no variant");
  const { body } = await client.gql(
    `mutation($input: CheckoutCreateInput!) { checkoutCreate(input: $input) { checkout { id } } }`,
    { input: { lines: [{ variantId: toGlobalId("ProductVariant", variant.id), quantity: 2 }] } },
  );
  const created = body.data?.checkoutCreate as { checkout: { id: string } } | undefined;
  if (!created) throw new Error(JSON.stringify(body.errors));
  checkoutId = created.checkout.id;
});

afterAll(async () => {
  await closeDb();
});

const INITIALIZE = `mutation($id: ID!, $gateway: PaymentGatewayToInitialize!, $amount: Decimal, $action: TransactionFlowStrategyEnum) {
  transactionInitialize(id: $id, paymentGateway: $gateway, amount: $amount, action: $action) {
    transaction { id name chargedAmount { amount } authorizedAmount { amount } events { type amount { amount } } }
    transactionEvent { type }
    data
    errors { field code message }
  }
}`;

const STATUS = `query($id: ID) {
  checkout(id: $id) {
    authorizeStatus
    chargeStatus
    totalBalance { amount currency }
    transactions { chargedAmount { amount } checkout { id } }
  }
}`;

type InitializeData = {
  transaction: {
    chargedAmount: { amount: number };
    authorizedAmount: { amount: number };
  } | null;
  transactionEvent: { type: string } | null;
  data: unknown;
  errors: { field: string | null; code: string; message?: string }[];
};

function initialized(result: GqlResult): InitializeData {
  expect(result.body.errors).toBeUndefined();
  return result.body.data?.transactionInitialize as InitializeData;
}

const gateway = (data?: unknown) => ({ id: "saleor.io.dummy-payment-app", data });

describe("transactionInitialize", () => {
  it("charges in parts and moves the checkout from NONE to PARTIAL to FULL", async () => {
    const before = await client.gql(STATUS, { id: checkoutId });
    expect(before.body.data?.checkout).toMatchObject({
      authorizeStatus: "NONE",
      chargeStatus: "NONE",
      totalBalance: { amount: -2000, currency: "MNT" },
    });

    const part = initialized(
      await client.gql(INITIALIZE, { id: checkoutId, gateway: gateway(), amount: "500" }),
    );
    expect(part).toMatchObject({
      transaction: {
        name: "Dummy payment",
        chargedAmount: { amount: 500 },
        events: [
          { type: "CHARGE_REQUEST", amount: { amount: 500 } },
          { type: "CHARGE_SUCCESS", amount: { amount: 500 } },
        ],
      },
      transactionEvent: { type: "CHARGE_SUCCESS" },
      data: null,
      errors: [],
    });
    const partial = await client.gql(STATUS, { id: checkoutId });
    expect(partial.body.data?.checkout).toMatchObject({ chargeStatus: "PARTIAL" });

    const rest = initialized(await client.gql(INITIALIZE, { id: checkoutId, gateway: gateway() }));
    expect(rest.transaction?.chargedAmount.amount).toBe(1500);

    const paid = await client.gql(STATUS, { id: checkoutId });
    expect(paid.body.data?.checkout).toEqual({
      authorizeStatus: "FULL",
      chargeStatus: "FULL",
      totalBalance: { amount: 0, currency: "MNT" },
      transactions: [
        { chargedAmount: { amount: 500 }, checkout: { id: checkoutId } },
        { chargedAmount: { amount: 1500 }, checkout: { id: checkoutId } },
      ],
    });
  });

  it("authorizes on request and records a declined payment from the gateway data", async () => {
    const authorized = initialized(
      await client.gql(INITIALIZE, { id: checkoutId, gateway: gateway(), action: "AUTHORIZATION" }),
    );
    expect(authorized.transaction?.authorizedAmount.amount).toBe(2000);
    const status = await client.gql(STATUS, { id: checkoutId });
    expect(status.body.data?.checkout).toMatchObject({
      authorizeStatus: "FULL",
      chargeStatus: "NONE",
    });

    const declined = initialized(
      await client.gql(INITIALIZE, {
        id: checkoutId,
        gateway: gateway({ event: { type: "CHARGE_FAILURE" } }),
        amount: "100",
      }),
    );
    expect(declined).toMatchObject({
      transaction: { chargedAmount: { amount: 0 } },
      transactionEvent: { type: "CHARGE_FAILURE" },
    });
  });

  it("returns payload errors for an unknown gateway or a non-checkout ID, top-level for an unknown checkout", async () => {
    expect(
      initialized(
        await client.gql(INITIALIZE, {
          id: checkoutId,
          gateway: { id: "mirumee.payments.stripe" },
        }),
      ).errors,
    ).toEqual([{ field: "paymentGateway", code: "NOT_FOUND", message: expect.any(String) }]);

    expect(
      initialized(
        await client.gql(INITIALIZE, {
          id: toGlobalId("Product", crypto.randomUUID()),
          gateway: gateway(),
        }),
      ).errors,
    ).toEqual([{ field: "id", code: "INVALID", message: expect.any(String) }]);

    const unknown = toGlobalId("Checkout", crypto.randomUUID());
    const result = await client.gql(INITIALIZE, { id: unknown, gateway: gateway() });
    expect(result.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '${JSON.stringify([unknown])}'.`,
    );
  });
});

describe("transactionInitialize with a redirect gateway (ADR-0016)", () => {
  const fake = createFakeGateway();
  const redirectClient = createTestClient(db, testGateways(fake));
  const REDIRECT = `mutation($id: ID!, $gateway: PaymentGatewayToInitialize!, $key: String) {
    transactionInitialize(id: $id, paymentGateway: $gateway, idempotencyKey: $key) {
      transaction { id pspReference externalUrl chargedAmount { amount } chargePendingAmount { amount } }
      transactionEvent { type externalUrl }
      data
      errors { field code message }
    }
  }`;
  const redirect = (data?: unknown) => ({ id: FAKE_GATEWAY_ID, data });

  // A gateway that settles later only takes checkouts that can become an order (ADR-0016 §7).
  beforeEach(async () => {
    const id = fromGlobalId("Checkout", checkoutId);
    const address = {
      firstName: "Bat",
      lastName: "Dorj",
      streetAddress1: "Peace Avenue 1",
      city: "Ulaanbaatar",
      country: "MN",
    };
    const method = await createShippingMethod(db, { name: "Standard", price: "0" });
    if (!method.ok) throw new Error(JSON.stringify(method.errors));
    await updateCheckoutEmail(db, id, "buyer@example.com");
    await updateCheckoutAddress(db, id, "SHIPPING", address);
    await updateCheckoutAddress(db, id, "BILLING", address);
    await updateCheckoutDeliveryMethod(db, id, method.shippingMethod.id);
  });

  it("returns the gateway's page in `data` and leaves the checkout unpaid until it settles", async () => {
    const result = initialized(
      await redirectClient.gql(REDIRECT, {
        id: checkoutId,
        gateway: redirect({ returnUrl: "http://localhost:3000/checkout/return" }),
      }),
    ) as unknown as {
      transaction: {
        externalUrl: string;
        chargedAmount: { amount: number };
        chargePendingAmount: { amount: number };
      };
      transactionEvent: { type: string; externalUrl: string };
      data: { url: string };
    };
    expect(result.transactionEvent.type).toBe("CHARGE_ACTION_REQUIRED");
    expect(result.data.url).toMatch(/^https:\/\/pay\.example\.test\//);
    expect(result.transaction).toMatchObject({
      externalUrl: result.data.url,
      chargedAmount: { amount: 0 },
      chargePendingAmount: { amount: 2000 },
    });
    expect(fake.calls.at(-1)).toMatchObject({
      method: "initialize",
      input: { amount: 2000, returnUrl: "http://localhost:3000/checkout/return" },
    });
    const status = await redirectClient.gql(STATUS, { id: checkoutId });
    expect(status.body.data?.checkout).toMatchObject({ chargeStatus: "NONE" });
  });

  it("refuses a return URL on a host that isn't allowed", async () => {
    const result = initialized(
      await redirectClient.gql(REDIRECT, {
        id: checkoutId,
        gateway: redirect({ returnUrl: "https://evil.example/steal" }),
      }),
    );
    expect(result).toMatchObject({
      transaction: null,
      errors: [{ field: "paymentGateway", code: "INVALID" }],
    });
    expect(result.errors[0]?.message).toMatch(/evil\.example is not allowed/);
  });

  it("is NOT_FOUND where the gateway isn't enabled", async () => {
    const result = initialized(await client.gql(REDIRECT, { id: checkoutId, gateway: redirect() }));
    expect(result).toMatchObject({ errors: [{ field: "paymentGateway", code: "NOT_FOUND" }] });
  });

  it("cancels the earlier unpaid attempt when the shopper starts another", async () => {
    const first = initialized(
      await redirectClient.gql(REDIRECT, { id: checkoutId, gateway: redirect(), key: "a" }),
    ) as unknown as { transaction: { pspReference: string } };
    initialized(
      await redirectClient.gql(REDIRECT, { id: checkoutId, gateway: redirect(), key: "b" }),
    );
    expect(fake.calls).toContainEqual({ method: "cancel", input: first.transaction.pspReference });
  });
});
