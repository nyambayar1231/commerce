// Products for the QA environment (scripts/test-env/start.sh), made through the API as the QA staff
// user, like the e2e helper (e2e/storefront/helpers.ts) — never by writing tables.
//   node scripts/test-env/seed.ts <api graphql url> <dashboard origin>
const [apiUrl, origin] = process.argv.slice(2);
if (!apiUrl || !origin) throw new Error("usage: seed.ts <api graphql url> <dashboard origin>");

// Test-only values (e2e/env.ts).
const STAFF_EMAIL = "e2e-staff@example.com";
const STAFF_PASSWORD = "e2e-staff-password-0123";

let cookie = "";

async function gql<T>(query: string, variables: object = {}): Promise<T> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0] ?? "";
  const body = (await response.json()) as { data?: T; errors?: unknown };
  if (!response.ok || body.errors) throw new Error(JSON.stringify(body.errors ?? response.status));
  return body.data as T;
}

const login = await gql<{ tokenCreate: { errors: unknown[] } }>(
  "mutation ($e: String!, $p: String!) { tokenCreate(email: $e, password: $p) { errors { code } } }",
  { e: STAFF_EMAIL, p: STAFF_PASSWORD },
);
if (login.tokenCreate.errors.length > 0) throw new Error(JSON.stringify(login.tokenCreate.errors));

const setup = await gql<{
  categories: { edges: { node: { id: string; name: string } }[] };
  warehouses: { edges: { node: { id: string } }[] };
}>(
  "{ categories(first: 1) { edges { node { id name } } } warehouses(first: 1) { edges { node { id } } } }",
);
const category = setup.categories.edges[0]?.node.id;
const warehouse = setup.warehouses.edges[0]?.node.id;
if (!category || !warehouse) throw new Error("no category or warehouse to seed into");

const PRODUCTS = [
  { name: "QA Аяга", price: 1000, stock: 50 },
  { name: "QA Цүнх", price: 45000, stock: 10 },
  // One left: the sold-out scenarios (two shoppers, the second can't buy).
  { name: "QA Сүүлийн ширхэг", price: 2000, stock: 1 },
];

for (const product of PRODUCTS) {
  const created = await gql<{
    productCreate: {
      errors: unknown[];
      product: { slug: string; variants: { id: string }[] } | null;
    };
  }>(
    `mutation ($input: ProductCreateInput!) {
      productCreate(input: $input) { errors { field code } product { slug variants { id } } }
    }`,
    { input: { name: product.name, category, price: String(product.price) } },
  );
  const variant = created.productCreate.product?.variants[0]?.id;
  if (created.productCreate.errors.length > 0 || !variant) {
    throw new Error(`${product.name}: ${JSON.stringify(created.productCreate.errors)}`);
  }
  await gql(
    `mutation ($v: ID!, $s: [StockInput!]!) {
      productVariantStocksCreate(variantId: $v, stocks: $s) { errors { field code } }
    }`,
    { v: variant, s: [{ warehouse, quantity: product.stock }] },
  );
  console.log(
    `${product.name}: ${product.price}₮, ${product.stock} in stock (/products/${created.productCreate.product?.slug})`,
  );
}
