import type { CurrencyCode } from "@commerce/contracts";
import { type SQL, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";

// Saleor's `where: ProductWhereInput` (saleor/graphql/product/filters/product.py, ProductWhere),
// reduced to the fields our tables can answer. Each field maps to an explicit SQL fragment over
// the `p` alias of `productList.ts`; there is no generic filter engine (ARCHITECTURE.md §9.3).
// The GraphQL layer parses global IDs and decimal amounts, so this module only sees primary keys,
// minor units and Dates.

// The shop's single currency (ADR-0005, ADR-0013): `@commerce/contracts` defines MNT only and
// `product_variant.currency` holds no other code, so price filters always parse into MNT minor
// units. When a second currency exists, read `shop_settings.currency` instead.
export const SHOP_CURRENCY: CurrencyCode = "MNT";

// `AND`/`OR` add a subquery per level. Five levels is far beyond anything the dashboard builds and
// bounds the size of the generated SQL.
export const MAX_WHERE_DEPTH = 5;

/** Saleor's StringFilterInput / GlobalIDFilterInput (exact match, no partial string filters). */
export interface ValueFilter {
  eq?: string | null;
  oneOf?: readonly string[] | null;
}

export interface RangeFilter<T> {
  gte?: T | null;
  lte?: T | null;
}

/** Saleor's DecimalFilterInput / DateTimeFilterInput: eq, oneOf, or a range. */
export interface ConditionFilter<T> {
  eq?: T | null;
  oneOf?: readonly T[] | null;
  range?: RangeFilter<T> | null;
}

/**
 * Saleor's ProductWhereInput, as the catalog module consumes it: global IDs already decoded and
 * decimal amounts already in minor units. Absent (`undefined`) means "no condition"; an explicitly
 * empty `oneOf` or `ids` matches nothing, as Saleor's `qs.none()`.
 */
export interface ProductWhere {
  ids?: readonly string[] | null;
  name?: ValueFilter | null;
  slug?: ValueFilter | null;
  /** Category primary keys; a product matches its own category and all its descendants. */
  category?: ValueFilter | null;
  hasCategory?: boolean | null;
  isPublished?: boolean | null;
  /** Matches when any variant's price satisfies the condition. */
  price?: ConditionFilter<number> | null;
  /** Matches when the lowest variant price satisfies the condition. */
  minimalPrice?: ConditionFilter<number> | null;
  updatedAt?: ConditionFilter<Date> | null;
  AND?: readonly ProductWhere[] | null;
  OR?: readonly ProductWhere[] | null;
}

const NONE = sql`FALSE`;

// `db.execute` passes parameters straight to postgres.js, which only accepts primitives: dates
// travel as ISO strings and Postgres casts them back to `timestamptz` from the column's type.
const param = (value: unknown): unknown => (value instanceof Date ? value.toISOString() : value);

const inList = (values: readonly unknown[]): SQL =>
  sql`(${sql.join(
    values.map((value) => sql`${param(value)}`),
    sql`, `,
  )})`;

/** Saleor's filter_where_by_value_field: `eq` wins over `oneOf`; an empty filter matches nothing. */
function valueFilter(column: SQL, filter: ValueFilter): SQL {
  if (filter.eq !== undefined) {
    return filter.eq === null ? sql`${column} IS NULL` : sql`${column} = ${filter.eq}`;
  }
  if (filter.oneOf && filter.oneOf.length > 0) return sql`${column} IN ${inList(filter.oneOf)}`;
  return NONE;
}

/** Saleor's filter_where_by_numeric_field: `eq`, then `oneOf`, then an open or closed range. */
function conditionFilter<T>(expression: SQL, filter: ConditionFilter<T>): SQL {
  if (filter.eq !== undefined) {
    return filter.eq === null
      ? sql`${expression} IS NULL`
      : sql`${expression} = ${param(filter.eq)}`;
  }
  if (filter.oneOf && filter.oneOf.length > 0) {
    return sql`${expression} IN ${inList(filter.oneOf)}`;
  }
  if (filter.range) {
    const bounds: SQL[] = [];
    if (filter.range.gte != null) {
      bounds.push(sql`${expression} >= ${param(filter.range.gte)}`);
    }
    if (filter.range.lte != null) {
      bounds.push(sql`${expression} <= ${param(filter.range.lte)}`);
    }
    if (bounds.length > 0) return sql.join(bounds, sql` AND `);
  }
  return NONE;
}

/**
 * Saleor's where_filter_by_categories: the category and every descendant, found by walking
 * `category.parent_id`. A CTE inside the subquery keeps the builder independent of the outer
 * query's CTEs (`productList.ts` has its own `subtree` for `Category.products`).
 */
function categoryFilter(filter: ValueFilter): SQL {
  const ids = filter.eq !== undefined ? (filter.eq === null ? [] : [filter.eq]) : filter.oneOf;
  if (!ids || ids.length === 0) return NONE;
  return sql`p.category_id IN (
    WITH RECURSIVE subtree_where AS (
      SELECT id FROM category WHERE id IN ${inList(ids)}
      UNION ALL
      SELECT child.id FROM category AS child
      JOIN subtree_where ON child.parent_id = subtree_where.id
    )
    SELECT id FROM subtree_where
  )`;
}

/** `price`: some variant's price matches (Saleor's filter_variant_price). */
const variantPrice = (filter: ConditionFilter<number>): SQL =>
  sql`EXISTS (
    SELECT 1 FROM product_variant AS v
    WHERE v.product_id = p.id AND ${conditionFilter(sql`v.price_amount`, filter)}
  )`;

/** `minimalPrice`: the lowest variant price matches; no variants means NULL, which never matches. */
const minimalPrice = (filter: ConditionFilter<number>): SQL =>
  conditionFilter(
    sql`(SELECT min(v.price_amount) FROM product_variant AS v WHERE v.product_id = p.id)`,
    filter,
  );

/**
 * One `WHERE` fragment for a `ProductWhereInput`. Fields in one object AND together; `AND`/`OR`
 * combine their objects. An object may not mix an operator with other fields (Saleor:
 * "Cannot mix operators with other filter inputs.").
 */
export function productWhereToSql(where: ProductWhere, depth = 1): SQL {
  if (depth > MAX_WHERE_DEPTH) {
    throw new GraphQLError(
      `The \`where\` argument is nested too deeply (maximum ${MAX_WHERE_DEPTH} levels).`,
    );
  }
  const hasOperator = where.AND !== undefined || where.OR !== undefined;
  const provided = Object.values(where).filter((value) => value !== undefined).length;
  if (hasOperator && provided > 1) {
    throw new GraphQLError("Cannot mix operators with other filter inputs.");
  }

  const conditions: SQL[] = [];
  if (where.ids != null) {
    conditions.push(where.ids.length === 0 ? NONE : sql`p.id IN ${inList(where.ids)}`);
  }
  if (where.name != null) conditions.push(valueFilter(sql`p.name`, where.name));
  if (where.slug != null) conditions.push(valueFilter(sql`p.slug`, where.slug));
  if (where.category != null) conditions.push(categoryFilter(where.category));
  if (where.hasCategory != null) {
    conditions.push(
      where.hasCategory ? sql`p.category_id IS NOT NULL` : sql`p.category_id IS NULL`,
    );
  }
  if (where.isPublished != null) conditions.push(sql`p.is_published = ${where.isPublished}`);
  if (where.price != null) conditions.push(variantPrice(where.price));
  if (where.minimalPrice != null) conditions.push(minimalPrice(where.minimalPrice));
  if (where.updatedAt != null) conditions.push(conditionFilter(sql`p.updated_at`, where.updatedAt));

  if (where.AND && where.AND.length > 0) {
    conditions.push(
      sql`(${sql.join(
        where.AND.map((child) => productWhereToSql(child, depth + 1)),
        sql` AND `,
      )})`,
    );
  }
  if (where.OR && where.OR.length > 0) {
    conditions.push(
      sql`(${sql.join(
        where.OR.map((child) => productWhereToSql(child, depth + 1)),
        sql` OR `,
      )})`,
    );
  }

  return conditions.length === 0 ? sql`TRUE` : sql.join(conditions, sql` AND `);
}
