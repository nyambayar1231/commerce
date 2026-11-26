import { expect, type Page, test } from "@playwright/test";
import mn from "../../apps/storefront/messages/mn.json" with { type: "json" };
import { FAKE_WIRE_URL, STOREFRONT_URL } from "../env.ts";
import {
  checkAxe,
  confirmationLink,
  createProduct,
  type TestProduct,
} from "../storefront/helpers.ts";

// Storefront golden paths (PLAN M4.11): a production build of the storefront, the real API, the
// real worker and Mailpit. Guest buys; a customer signs up, confirms by email, logs in and buys.
// axe (WCAG 2.1 A/AA) runs on every page visited. Selectors are the Mongolian texts of
// messages/mn.json, so a copy change breaks the test where it is read, not silently.
test.describe.configure({ mode: "serial" });
test.use({ baseURL: STOREFRONT_URL, locale: "mn-MN" });

const PRICE = 45000;
let product: TestProduct;
const customerEmail = `e2e-customer-${Date.now()}@example.com`;
const customerPassword = "e2e-customer-password-0123";

test.beforeAll(async ({ playwright }) => {
  const staff = await playwright.request.newContext();
  product = await createProduct(staff, PRICE, 20);
  await staff.dispose();
});

/** Product page → cart → checkout → order page. Returns the order's number as the page shows it. */
async function buy(page: Page, { email }: { email?: string }) {
  await page.goto("/");
  await checkAxe(page, "home");

  await page.getByRole("link", { name: mn.nav.allProducts }).first().click();
  await expect(page).toHaveURL(/\/products/);
  await checkAxe(page, "products");

  await page
    .getByRole("link", { name: new RegExp(product.name) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/products/${product.slug}`));
  await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
  await checkAxe(page, "product");

  await page.getByRole("button", { name: mn.pdp.addToCart, exact: true }).first().click();
  // The cart drawer opens once the item is in the cart; its link leads to the cart page.
  const drawer = page.getByRole("dialog", { name: mn.cart.drawerTitle });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: mn.cart.viewCart }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { level: 1, name: mn.cart.title })).toBeVisible();
  await expect(page.getByRole("main").getByText(product.name).first()).toBeVisible();
  await checkAxe(page, "cart");

  await page.getByRole("main").getByRole("link", { name: mn.cart.checkout }).click();
  await expect(page).toHaveURL(/\/checkout/);

  // A signed-in customer starts at shipping (the checkout knows the email); a guest gives one.
  if (email) {
    await expect(page.getByRole("heading", { name: mn.checkout.contact.title })).toBeVisible();
    await checkAxe(page, "checkout contact");
    await page.getByLabel(mn.checkout.contact.email).fill(email);
    await page.getByRole("button", { name: mn.checkout.contact.continue }).click();
  }

  await expect(page.getByRole("heading", { name: mn.checkout.shipping.title })).toBeVisible();
  await checkAxe(page, "checkout shipping");
  const f = mn.address.fields;
  await page.getByLabel(f.firstName, { exact: true }).fill("Бат");
  await page.getByLabel(f.lastName, { exact: true }).fill("Доржийн");
  await page.getByLabel(f.countryArea, { exact: true }).fill("Улаанбаатар");
  await page.getByLabel(f.city, { exact: true }).fill("Сүхбаатар");
  await page.getByLabel(f.cityArea, { exact: true }).fill("1-р хороо");
  await page.getByLabel(f.streetAddress1, { exact: true }).fill("Энхтайвны өргөн чөлөө 1");
  await page.getByLabel(f.phone, { exact: true }).fill("99112233");
  await page.getByRole("button", { name: mn.checkout.shipping.save }).click();

  await expect(page.getByRole("heading", { name: mn.checkout.shipping.methodTitle })).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: mn.checkout.shipping.continue }).click();

  await expect(
    page.getByRole("heading", { name: mn.checkout.payment.title, level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel(mn.checkout.payment.sameAsShipping)).toBeChecked();
  await checkAxe(page, "checkout payment");
  // QPay through Wire (ADR-0016): the shopper is sent to Wire's page (the fake Wire here), pays
  // there, and Wire sends them back to /checkout/return, which lands on the order.
  await expect(page.getByText(mn.checkout.payment.providers.wire).first()).toBeVisible();
  await page.getByRole("button", { name: mn.checkout.payment.placeOrder }).click();
  await expect(page).toHaveURL(new RegExp(`^${FAKE_WIRE_URL}/c/cs_`));
  await page.getByRole("button", { name: "Pay with QPay" }).click();

  await expect(page).toHaveURL(/\/order\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: mn.order.thankYou })).toBeVisible();
  await expect(page.getByText(product.name).first()).toBeVisible();
  await checkAxe(page, "order");
  const label = await page.getByText(/№\d+/).first().textContent();
  const number = /№(\d+)/.exec(label ?? "")?.[1];
  expect(number, "the order page shows the order number").toBeTruthy();
  return number as string;
}

test("a guest buys a product", async ({ page }) => {
  await buy(page, { email: "e2e-guest@example.com" });
});

test("a customer signs up, confirms by email, logs in and buys", async ({ page, request }) => {
  await page.goto("/signup");
  await checkAxe(page, "signup");
  await page.getByLabel(mn.auth.lastName, { exact: true }).fill("Доржийн");
  await page.getByLabel(mn.auth.firstName, { exact: true }).fill("Бат");
  await page.getByLabel(mn.auth.email, { exact: true }).fill(customerEmail);
  await page.getByLabel(mn.auth.password, { exact: true }).fill(customerPassword);
  await page.getByLabel(mn.auth.confirmPassword, { exact: true }).fill(customerPassword);
  await page.getByRole("button", { name: mn.auth.signup.submit }).click();
  await expect(page.getByRole("heading", { name: mn.auth.signup.successTitle })).toBeVisible();

  // Until the link is opened the account can't log in (ACCOUNT_NOT_CONFIRMED).
  const link = await confirmationLink(request, customerEmail);
  await page.goto(link);
  await checkAxe(page, "confirm account");
  await page.getByRole("button", { name: mn.auth.confirm.submit }).click();
  await expect(page.getByRole("heading", { name: mn.auth.confirm.successTitle })).toBeVisible();

  await page.goto("/login");
  await checkAxe(page, "login");
  await page.getByLabel(mn.auth.email, { exact: true }).fill(customerEmail);
  await page.getByLabel(mn.auth.password, { exact: true }).fill(customerPassword);
  await page.getByRole("button", { name: mn.auth.login.submit }).click();
  await expect(page).toHaveURL(/\/account$/);
  await checkAxe(page, "account");

  const number = await buy(page, {});

  await page.goto("/account/orders");
  await expect(page.getByRole("heading", { level: 1, name: mn.orders.title })).toBeVisible();
  await checkAxe(page, "account orders");
  await page
    .getByRole("link", { name: new RegExp(`^${mn.orders.number.replace("{number}", number)}`) })
    .click();
  await expect(page).toHaveURL(/\/account\/orders\/[^/]+/);
  await expect(page.getByText(product.name).first()).toBeVisible();
  await checkAxe(page, "account order");
});
