// `pnpm schema:print` — writes the public GraphQL contract to apps/api/schema.graphql.
// The file is committed: reviewers see API changes as a diff, and the dashboard and storefront
// generate their types from it (M0.3). Re-run after every schema change.
import { writeFile } from "node:fs/promises";
import { printSchema } from "graphql";
import { schema } from "./graphql/schema.ts";

const target = new URL("../schema.graphql", import.meta.url);
await writeFile(target, `${printSchema(schema)}\n`);
console.log(`Wrote ${target.pathname}`);
