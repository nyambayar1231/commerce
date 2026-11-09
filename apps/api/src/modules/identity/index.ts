// Public surface of the `identity` module (ARCHITECTURE.md §2): other modules import from here
// only. `password.ts` stays internal until a second module needs it.

export type { CreateSuperuserInput } from "./users.ts";
export { CreateSuperuserError, createSuperuser } from "./users.ts";
