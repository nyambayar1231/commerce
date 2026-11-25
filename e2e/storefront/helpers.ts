import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { API_URL, DASHBOARD_URL, MAILPIT_URL, STAFF_EMAIL, STAFF_PASSWORD } from "../env.ts";

/** A GraphQL request to the API as the staff user (the context keeps the login cookie). */
export async function gql<T>(
  request: APIRequestContext,
  query: string,
  variables: object = {},
): Promise<T> {
  const response = await request.post(API_URL, {
    headers: { "content-type": "application/json", origin: DASHBOARD_URL },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { data?: T; errors?: unknown };
  expect(body.errors).toBeUndefined();
  return body.data as T;
}

export type TestProduct = { name: string; slug: string };

/**
 * One published product with one variant that has a price and stock, made through the API as the
 * staff user (never by writing tables). The name is unique per run.
 */
export async function createProduct(request: APIRequestContext, price: number, stock: number) {
  const login = await gql<{ tokenCreate: { errors: unknown[] } }>(
    request,
    "mutation ($e: String!, $p: String!) { tokenCreate(email: $e, password: $p) { errors { code } } }",
    { e: STAFF_EMAIL, p: STAFF_PASSWORD },
  );
  expect(login.tokenCreate.errors).toEqual([]);

  const setup = await gql<{
    categories: { edges: { node: { id: string; name: string } }[] };
    warehouses: { edges: { node: { id: string } }[] };
  }>(
    request,
    `{ categories(first: 1) { edges { node { id name } } } warehouses(first: 1) { edges { node { id } } } }`,
  );
  const category = setup.categories.edges[0]?.node.id;
  const warehouse = setup.warehouses.edges[0]?.node.id;
  expect(category && warehouse).toBeTruthy();

  const name = `E2E Storefront Shirt ${Date.now()}`;
  // With a category and a price the product is created published, with one default variant.
  const created = await gql<{
    productCreate: {
      errors: unknown[];
      product: { slug: string; variants: { id: string }[] } | null;
    };
  }>(
    request,
    `mutation ($input: ProductCreateInput!) {
      productCreate(input: $input) { errors { field code } product { slug variants { id } } }
    }`,
    { input: { name, category, price: String(price) } },
  );
  expect(created.productCreate.errors).toEqual([]);
  const product = created.productCreate.product;
  const variantId = product?.variants[0]?.id;
  expect(variantId).toBeTruthy();

  const stocked = await gql<{ productVariantStocksCreate: { errors: unknown[] } }>(
    request,
    `mutation ($v: ID!, $s: [StockInput!]!) {
      productVariantStocksCreate(variantId: $v, stocks: $s) { errors { field code } }
    }`,
    { v: variantId, s: [{ warehouse, quantity: stock }] },
  );
  expect(stocked.productVariantStocksCreate.errors).toEqual([]);
  return { name, slug: product?.slug ?? "" } satisfies TestProduct;
}

type MailpitMessage = { ID: string };

/** The link to /confirm-account in the sign-up email sent to `address`, polled from Mailpit. */
export async function confirmationLink(request: APIRequestContext, address: string) {
  let link = "";
  await expect
    .poll(
      async () => {
        const search = await request.get(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
        );
        const { messages } = (await search.json()) as { messages: MailpitMessage[] };
        for (const { ID } of messages) {
          const message = (await (
            await request.get(`${MAILPIT_URL}/api/v1/message/${ID}`)
          ).json()) as {
            Text: string;
            HTML: string;
          };
          const match = /https?:\/\/[^\s"'<>]*\/confirm-account\?[^\s"'<>]+/.exec(
            `${message.Text}\n${message.HTML}`,
          );
          if (match) {
            link = match[0].replaceAll("&amp;", "&");
            return true;
          }
        }
        return false;
      },
      { message: `no confirmation email for ${address} in Mailpit`, timeout: 30_000 },
    )
    .toBe(true);
  return link;
}

/** axe results per page, printed at the end of the run. */
export const axeLog: string[] = [];

/**
 * axe with the WCAG 2.1 A and AA tags: `serious` and `critical` violations fail the test; lower
 * impacts are logged (not failed).
 */
export async function checkAxe(page: Page, label: string) {
  // The shop name streams in after the shell (Suspense): axe must not read the empty fallback.
  await page.waitForLoadState("load");
  await expect
    .poll(async () => (await page.locator('a[href="/"]').allTextContents()).every((t) => t.trim()))
    .toBe(true);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const byImpact: Record<string, string[]> = {};
  for (const violation of violations) {
    const impact = violation.impact ?? "unknown";
    byImpact[impact] ??= [];
    byImpact[impact].push(`${violation.id} (${violation.nodes.length})`);
  }
  const summary = Object.entries(byImpact)
    .map(([impact, ids]) => `${impact}: ${ids.join(", ")}`)
    .join("; ");
  const line = `axe ${label}: ${summary || "no violations"}`;
  axeLog.push(line);
  console.log(line);
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    blocking.map(
      (v) =>
        `${v.id} [${v.impact}]: ${v.help}\n${v.nodes
          .map(
            (n) =>
              `  ${n.html.slice(0, 160)}\n    ${n.failureSummary?.split("\n").slice(0, 3).join(" ")}`,
          )
          .join("\n")}`,
    ),
    `axe: serious or critical violations on ${label}`,
  ).toEqual([]);
}
