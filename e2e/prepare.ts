// Recreates the e2e database before the API starts (playwright.config.ts runs it in the API's
// webServer command, so it always precedes the server): drop, create, migrate, then the staff
// superuser and the demo categories and shipping methods through the API's own CLI.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runMigrations } from "@commerce/db/migrate";
import postgres from "postgres";
import { e2eDatabaseUrl, STAFF_EMAIL, STAFF_PASSWORD } from "./env.ts";

const target = e2eDatabaseUrl();
const name = new URL(target).pathname.slice(1);
if (!name.endsWith("_e2e")) throw new Error(`Refusing to recreate ${name}: must end in _e2e`);

const adminUrl = new URL(target);
adminUrl.pathname = "/postgres";
const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE "${name}"`);
await admin.end();

await runMigrations(target);

const cli = fileURLToPath(new URL("../apps/api/src/cli.ts", import.meta.url));
const env = { ...process.env, DATABASE_URL: target, SUPERUSER_PASSWORD: STAFF_PASSWORD };
const run = (...args: string[]) => execFileSync("node", [cli, ...args], { env, stdio: "inherit" });
run("createsuperuser", "--no-input", "--email", STAFF_EMAIL, "--first-name", "E2E");
run("seed-catalog");
run("seed-shipping");
