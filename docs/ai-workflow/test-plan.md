# QA test plan (browser)

The journeys the tester agent (`.opencode/agents/tester.md`) walks in the QA environment
(`scripts/test-env/start.sh`, [testing.md](testing.md)). Each step says what to expect; the tester
records what it saw. The lead picks journeys per run in the brief (all, or the ones a change
touches) and re-checks every FAIL itself.

Seeded by the environment: products "QA Аяга" (1,000₮, 50 in stock), "QA Цүнх" (45,000₮, 10),
"QA Сүүлийн ширхэг" (2,000₮, 1 in stock); delivery methods "Standard" (5,000₮) and "Express"
(15,000₮); staff `e2e-staff@example.com` (test values, dashboard only).

## J1 Browse
1. Open `http://localhost:3113/`. Expect: the shop name in the header, Mongolian text, no error.
2. Open `/products`. Expect: the three QA products with their prices; a count; filter buttons.
3. Price filter "₮ 50,000 хүртэл". Expect: QA Цүнх (45,000₮) and the others ≤ 50,000₮ remain.
4. Search "QA" in the header. Expect: the three products.
5. Open "QA Аяга". Expect: name, 1,000₮, "Бэлэн байна", an add-to-cart button.

## J2 Guest buys with QPay
1. On "QA Аяга", add to cart twice. Expect: the cart drawer opens; the header count shows 2.
2. Open the cart (`/cart`). Change the quantity to 3, then back to 2. Expect: totals follow (2,000₮).
3. Checkout. Contact: `qa-guest-<time>@example.com`, continue. Expect: the shipping step.
4. Fill the address (Улаанбаатар / Сүхбаатар / 1-р хороо / a street / phone 99112233), save.
   Expect: delivery methods appear (Standard 5,000₮, Express 15,000₮).
5. Choose Standard, continue. Expect: payment step, QPay offered, total 7,000₮.
6. Place the order. Expect: the fake Wire page (`localhost:4199/c/cs_…`) showing 7000 MNT.
7. Click "Pay with QPay". Expect: back on the shop, then the order page ("Баярлалаа" heading), the
   product and 7,000₮, an order number.
8. Mailpit: an order confirmation to that email.

## J3 Payment not finished
1. As J2 up to step 6 with a new email; on the fake Wire page click "Cancel" (or go back to
   `localhost:3113/checkout/return`). Expect: back on the payment step with the message that the
   payment didn't happen (or the waiting page), and no order in the dashboard for that email.
2. Place the order again and pay. Expect: one order only.

## J4 Customer account
1. Sign up (`/signup`) with `qa-customer-<time>@example.com` and a test password. Expect: a
   message to confirm by email.
2. Mailpit: open the confirmation email, follow its link. Expect: account confirmed.
3. Log in. Expect: the account page.
4. Account → addresses: add an address, set it as default. Expect: it shows as default.
5. Buy "QA Цүнх" as this customer (saved address offered at checkout), pay on the fake Wire page.
   Expect: the order page; then `/account/orders` lists it; its detail page shows the product.
6. Account settings: change the first name. Expect: saved.
7. Log out. Expect: the header shows "Нэвтрэх" again.

## J5 Staff: order and refund
1. Dashboard `http://localhost:5283`, sign in with the QA staff account.
2. Orders: find the J2 order (by the guest email). Expect: paid, the transaction "Wire (QPay)"
   with a CHARGE_SUCCESS event.
3. Refund 1,000₮ from the transaction. Expect: refunded amount shown, the event list grows.
4. Fulfil the order. Expect: status changes to fulfilled.

## J6 Last item, two shoppers
1. Tab A (normal window): add "QA Сүүлийн ширхэг" to the cart, go to the payment step.
2. In the dashboard set that product's stock to 0 (or buy it first in a second, private window).
3. Tab A: place the order. Expect: a clear Mongolian message that the item is not available, no
   payment page, or — if already paid — the "payment returned" notice. Never an order for an item
   that isn't there.

## J7 Mobile width
1. Repeat J1.1–J1.5 and J2.1–J2.5 at a phone-sized window (about 390 px wide). Expect: nothing
   cut off, the menu and filters usable, buttons reachable.
