// `pnpm cli` — operator commands for the commerce API. The root package.json forwards here
// (`pnpm --filter @commerce/api cli`); the GraphQL server never loads this file. The domain
// logic lives in the `identity` module; this file is only argument handling and I/O.
//
// Usage: node src/cli.ts <command> [options]
//   pnpm cli createsuperuser                                        # interactive prompts
//   pnpm cli createsuperuser --no-input --email <email> [--first-name <name>] [--last-name <name>]
//                                                                   # scripted: the password
//                                                                   # is read from the
//                                                                   # SUPERUSER_PASSWORD env
//                                                                   # var (Django/Saleor's
//                                                                   # `createsuperuser
//                                                                   # --noinput` convention)
//   pnpm cli seed-catalog                                           # demo category tree
//                                                                   # (local development;
//                                                                   # safe to run again)
//   pnpm cli create-media-bucket                                    # the media bucket
//                                                                   # (local development;
//                                                                   # safe to run again)

import { createInterface, type Interface } from "node:readline/promises";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import { closeDb, getDb } from "@commerce/db";
import { seedDemoCatalog } from "./modules/catalog/index.ts";
import { type CreateSuperuserInput, createSuperuser } from "./modules/identity/index.ts";
import { getStorage, readStorageConfig } from "./storage/index.ts";

const USAGE = `Usage: pnpm cli <command> [options]

Commands:
  createsuperuser      Create a staff superuser account
  seed-catalog         Create the demo category tree (local development; safe to run again)
  create-media-bucket  Create the media bucket when it does not exist (safe to run again)

Options for createsuperuser:
  --no-input                 Take all values from flags and the environment instead of prompting
  --email <email>            (with --no-input) the new superuser's email
  --first-name <name>        (with --no-input) optional first name
  --last-name <name>         (with --no-input) optional last name

With --no-input the password is read from the SUPERUSER_PASSWORD environment variable. A
password is never accepted as a command-line flag, because flags land in shell history.`;

// readline writes everything — the prompt, each typed character and the Enter newline —
// through its `output` stream (its internal `_writeToOutput` method, which Node 22 keeps
// behind a private symbol, so the method cannot be swapped). Wrapping stdout in a stream that
// can drop writes hides the password the same way `getpass` does for Django/Saleor's
// `createsuperuser`: write the prompt, mute, collect the answer, unmute, print the newline
// that readline swallowed.
class MuteableOutput extends Writable {
  private muted = false;

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) process.stdout.write(chunk);
    callback();
  }

  mute(): void {
    this.muted = true;
  }

  unmute(): void {
    this.muted = false;
  }
}

type FlagValues = {
  "no-input": boolean;
  email?: string;
  "first-name"?: string;
  "last-name"?: string;
};

async function main(): Promise<void> {
  let command: string | undefined;
  let values: FlagValues;
  try {
    const parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        "no-input": { type: "boolean", default: false },
        email: { type: "string" },
        "first-name": { type: "string" },
        "last-name": { type: "string" },
      },
    });
    [command] = parsed.positionals;
    if (parsed.positionals.length > 1) command = undefined; // a stray extra argument
    values = parsed.values as FlagValues;
  } catch (error) {
    // e.g. an unknown flag such as --password
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  if (command === "create-media-bucket") {
    try {
      const { bucket } = readStorageConfig(process.env);
      await getStorage().ensureBucket();
      console.log(`Media bucket ready: ${bucket}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "seed-catalog") {
    try {
      const { created, skipped } = await seedDemoCatalog(getDb());
      console.log(`Demo catalog: ${created} categories created, ${skipped} already there.`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    return;
  }

  if (command !== "createsuperuser") {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  try {
    const input = values["no-input"] ? inputFromFlags(values) : await promptForInput();
    const created = await createSuperuser(getDb(), input);
    console.log(`Superuser created: ${created.email}`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function inputFromFlags(values: FlagValues): CreateSuperuserInput {
  if (!values.email) {
    throw new Error("--email is required together with --no-input");
  }

  const password = process.env.SUPERUSER_PASSWORD;
  if (!password) {
    throw new Error(
      "SUPERUSER_PASSWORD is not set (required with --no-input; the password is never taken as a flag)",
    );
  }

  return {
    email: values.email,
    password,
    firstName: values["first-name"],
    lastName: values["last-name"],
  };
}

async function promptForInput(): Promise<CreateSuperuserInput> {
  const output = new MuteableOutput();
  const rl = createInterface({
    input: process.stdin,
    output,
    // readline's default is `input.isTTY && output.isTTY`, but the wrapper stream is not a
    // TTY. Compute it from the real streams: on a terminal this turns on raw mode and
    // keypress echo (muted during password entry); piped input keeps plain whole-line reads.
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });

  try {
    const email = await rl.question("Email: ");
    const firstName = await rl.question("First name (optional): ");
    const lastName = await rl.question("Last name (optional): ");
    const password = await promptPassword(rl, output, "Password: ");
    const again = await promptPassword(rl, output, "Password (again): ");

    if (password !== again) {
      throw new Error("Passwords do not match.");
    }

    return {
      email,
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    };
  } finally {
    rl.close();
  }
}

async function promptPassword(
  rl: Interface,
  output: MuteableOutput,
  prompt: string,
): Promise<string> {
  output.write(prompt);
  output.mute();
  try {
    return await rl.question("");
  } finally {
    output.unmute();
    // The Enter that submitted the line was muted together with the typed characters.
    output.write("\n");
  }
}

await main().finally(() => closeDb());
