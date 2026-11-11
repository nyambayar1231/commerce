import { CURRENCIES, type Money } from "@commerce/contracts";
import { builder } from "./builder.ts";

// Saleor's Money: { amount: Float!, currency: String! } (ADR-0013). Values stay integer minor
// units everywhere else; only here does `amount` become a decimal number (with MNT's exponent 0
// it equals amountMinor).

/** Money's decimal amount: minor units divided by 10^exponent. */
export const moneyAmount = (money: Money): number =>
  money.amountMinor / 10 ** CURRENCIES[money.currency].exponent;

export const MoneyType = builder.objectRef<Money>("Money").implement({
  description: "Represents amount of money in specific currency.",
  fields: (t) => ({
    currency: t.string({ description: "Currency code.", resolve: (money) => money.currency }),
    amount: t.float({ description: "Amount of money.", resolve: moneyAmount }),
  }),
});

// Saleor's TaxedMoney (saleor/graphql/core/types/common.py). Tax is zero for now, so `net` and
// `gross` are the same amount (ARCHITECTURE.md §5.2).
export type TaxedMoney = {
  currency: Money["currency"];
  net: Money;
  gross: Money;
  tax: Money;
};

export const TaxedMoneyType = builder.objectRef<TaxedMoney>("TaxedMoney").implement({
  fields: (t) => ({
    currency: t.string({ description: "Currency code.", resolve: (money) => money.currency }),
    gross: t.field({
      type: MoneyType,
      description: "Amount of money including taxes.",
      resolve: (money) => money.gross,
    }),
    net: t.field({
      type: MoneyType,
      description: "Amount of money without taxes.",
      resolve: (money) => money.net,
    }),
    tax: t.field({
      type: MoneyType,
      description: "Amount of taxes.",
      resolve: (money) => money.tax,
    }),
  }),
});
