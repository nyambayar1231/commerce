import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { API_URL, DASHBOARD_URL, STAFF_EMAIL, STAFF_PASSWORD } from "../env.ts";

// The golden path (PLAN M9.7, ARCHITECTURE §11): staff creates a published product with stock in
// the dashboard → a customer buys it through the GraphQL API (the storefront is M4) → staff finds
// the order in the dashboard and fulfils it. The steps share state, so they run in order.
test.describe.configure({ mode: "serial" });

const PRODUCT = `E2E Hoodie ${Date.now()}`;
const SKU = `E2E-${Date.now()}`;
const PRICE = 45000;
let page: Page;
let productUrl = "";
let variantId = "";
let orderId = "";
let orderNumber = "";

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

/** A GraphQL request as the storefront would send it (anonymous, with Yoga's CSRF header). */
async function gql<T>(request: APIRequestContext, query: string, variables: object): Promise<T> {
  const response = await request.post(API_URL, {
    headers: { "content-type": "application/json", origin: DASHBOARD_URL },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { data?: T; errors?: unknown };
  expect(body.errors).toBeUndefined();
  return body.data as T;
}

test("staff logs in", async () => {
  await page.goto("/");
  await page.getByLabel("Email address").fill(STAFF_EMAIL);
  await page.getByTestId("password").fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(STAFF_EMAIL)).toBeVisible();
});

test("staff creates a product with a category", async () => {
  await page.goto("/products");
  await page.getByRole("button", { name: "Create Product" }).click();
  const dialog = page.getByTestId("create-product-dialog");
  await dialog.getByTestId("product-name-input").fill(PRODUCT);
  await dialog.getByRole("combobox", { name: "Category" }).fill("Гутал");
  await page.getByRole("option", { name: "Гутал", exact: true }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/products\/[^/?]+/);
  await expect(page.getByTestId("product-variants")).toBeVisible();
  productUrl = page.url();
});

test("staff adds a variant with a price and stock", async () => {
  await page.getByTestId("button-add-variant").click();
  await expect(page).toHaveURL(/\/variant\/add/);
  await page.getByRole("textbox", { name: "Name" }).fill("One size");
  await page.getByRole("textbox", { name: "Price MNT" }).fill(String(PRICE));
  await page.getByRole("textbox", { name: "SKU (Stock Keeping Unit)" }).fill(SKU);
  await page.getByRole("button", { name: "Assign Warehouses" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await page
    .getByTestId("stock-input")
    .locator("input")
    .or(page.getByTestId("stock-input"))
    .first()
    .fill("5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/variant\/(?!add)[^/?]+/);
  variantId = decodeURIComponent(/\/variant\/([^/?]+)/.exec(page.url())?.[1] ?? "");
  expect(variantId).not.toBe("");
});

test("staff publishes the product", async () => {
  await page.goto(productUrl);
  await page.getByRole("button", { name: "Published" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved changes")).toBeVisible();
});

test("a customer buys it through the API", async ({ request }) => {
  const product = await gql<{ products: { edges: { node: { name: string } }[] } }>(
    request,
    "query ($s: String) { products(first: 5, search: $s) { edges { node { name } } } }",
    { s: PRODUCT },
  );
  // Anonymous callers see only published products.
  expect(product.products.edges.map((e) => e.node.name)).toEqual([PRODUCT]);

  const created = await gql<{
    checkoutCreate: {
      checkout: { id: string; shippingMethods: { id: string }[] };
      errors: unknown[];
    };
  }>(
    request,
    `mutation ($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) { checkout { id shippingMethods { id } } errors { field code } }
    }`,
    { input: { email: "e2e-buyer@example.com", lines: [{ variantId, quantity: 2 }] } },
  );
  expect(created.checkoutCreate.errors).toEqual([]);
  const { id, shippingMethods } = created.checkoutCreate.checkout;
  const address = {
    firstName: "Bat",
    lastName: "Dorj",
    streetAddress1: "Peace Ave 1",
    city: "Ulaanbaatar",
    country: "MN",
  };
  await gql(
    request,
    `mutation ($id: ID!, $a: AddressInput!, $m: ID) {
      s: checkoutShippingAddressUpdate(id: $id, shippingAddress: $a) { errors { code } }
      b: checkoutBillingAddressUpdate(id: $id, billingAddress: $a) { errors { code } }
      d: checkoutDeliveryMethodUpdate(id: $id, deliveryMethodId: $m) { errors { code } }
    }`,
    { id, a: address, m: shippingMethods[0]?.id },
  );
  await gql(
    request,
    `mutation ($id: ID!) {
      transactionInitialize(id: $id, paymentGateway: { id: "saleor.io.dummy-payment-app" }) { errors { code } }
    }`,
    { id },
  );
  const placed = await gql<{
    checkoutComplete: { order: { id: string; number: string } | null; errors: unknown[] };
  }>(
    request,
    "mutation ($id: ID!) { checkoutComplete(id: $id) { order { id number } errors { field code } } }",
    { id },
  );
  expect(placed.checkoutComplete.errors).toEqual([]);
  orderId = placed.checkoutComplete.order?.id ?? "";
  orderNumber = placed.checkoutComplete.order?.number ?? "";
  expect(orderNumber).not.toBe("");
});

test("staff finds the order and fulfils it", async () => {
  // The order list is a canvas datagrid (Saleor's Glide grid) with no row text to click, so the
  // order page is opened by its URL, as a row click would.
  await page.goto(`/orders/${encodeURIComponent(orderId)}`);
  await expect(page.getByText(`#${orderNumber}`).first()).toBeVisible();
  await expect(page.getByText("Unfulfilled order lines")).toBeVisible();
  await page.getByRole("button", { name: "Fulfill", exact: true }).click();
  await expect(page).toHaveURL(/\/fulfill/);
  await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("2");
  // The save bar's button (the page title's breadcrumb also reads "Fulfill…").
  await page.getByRole("button", { name: "Fulfill", exact: true }).last().click();
  await expect(page.getByText("Fulfilled").first()).toBeVisible();

  // The API agrees: fulfilled, and the stock went from 5 to 3 (read with the staff's cookie).
  const response = await page.request.post(API_URL, {
    headers: { "content-type": "application/json", origin: DASHBOARD_URL },
    data: {
      query: `query ($o: ID!, $v: ID!) {
        order(id: $o) { status }
        productVariant(id: $v) { stocks { quantity quantityAllocated } }
      }`,
      variables: { o: orderId, v: variantId },
    },
  });
  expect(await response.json()).toEqual({
    data: {
      order: { status: "FULFILLED" },
      productVariant: { stocks: [{ quantity: 3, quantityAllocated: 0 }] },
    },
  });
});
