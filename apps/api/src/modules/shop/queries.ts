import { type Executor, schema } from "@commerce/db";

export type Shop = {
  name: string;
  currency: string;
};

export async function getShop(db: Executor): Promise<Shop> {
  const [shop] = await db
    .select({ name: schema.shopSettings.name, currency: schema.shopSettings.currency })
    .from(schema.shopSettings);

  // The seed migration guarantees this row; its absence means migrations weren't run.
  if (!shop) throw new Error("shop_settings row is missing — run `pnpm db:migrate`");
  return shop;
}
