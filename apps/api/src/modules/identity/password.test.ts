import { hash, parseOptions } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.ts";

describe("hashPassword", () => {
  it("returns an argon2id hash, not the plain text", async () => {
    const hashValue = await hashPassword("correct horse battery staple");

    expect(hashValue).not.toContain("correct horse battery staple");
    expect(hashValue.startsWith("$argon2id$")).toBe(true);
  });

  it("uses a fresh salt for every hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");

    expect(second).not.toBe(first);
  });

  it("pins the OWASP parameters (argon2id, m=19456, t=2, p=1)", async () => {
    const hashValue = await hashPassword("owasp parameters");

    const options = parseOptions(hashValue);
    expect(options.algorithm).toBe(2); // Algorithm.Argon2id, as a literal (const enum)
    expect(options.memoryCost).toBe(19456); // 19 MiB
    expect(options.timeCost).toBe(2);
    expect(options.parallelism).toBe(1);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const hashValue = await hashPassword("right password");

    await expect(verifyPassword(hashValue, "right password")).resolves.toBe(true);
    await expect(verifyPassword(hashValue, "wrong password")).resolves.toBe(false);
  });

  it("returns false (does not throw) for a malformed hash", async () => {
    await expect(verifyPassword("not-an-argon2-hash", "anything")).resolves.toBe(false);
  });

  it("rejects a real argon2i hash even with the right password", async () => {
    // 1 = Algorithm.Argon2i (0 = Argon2d, 1 = Argon2i, 2 = Argon2id per index.d.ts), as a
    // literal: same const-enum workaround as password.ts. The remaining parameters are the
    // library defaults; they do not matter, verifyPassword rejects on the variant prefix.
    const argon2iHash = await hash("right password", { algorithm: 1 });

    expect(argon2iHash.startsWith("$argon2i$")).toBe(true);
    await expect(verifyPassword(argon2iHash, "right password")).resolves.toBe(false);
  });
});
