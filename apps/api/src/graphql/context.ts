import type { Db } from "@commerce/db";

// What every resolver receives as its third argument. Created once per request (see app.ts).
export interface Context {
  db: Db;
}
