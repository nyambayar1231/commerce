import { hash, verify } from "@node-rs/argon2";

// Password hashing with argon2id. Argon2id is the OWASP-recommended KDF: memory-hard against GPU
// attacks with the Argon2i-like first pass against side channels (OWASP Password Storage Cheat
// Sheet). `@node-rs/argon2` ships prebuilt native binaries, so it has no install script (which
// pnpm blocks): `pnpm install` just works.

// OWASP Password Storage Cheat Sheet: use argon2id with at least 19 MiB of memory, t=2, p=1.
// 19456 KiB = 19 MiB.
const ARGON2ID_PARAMS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  // Algorithm.Argon2id, as a literal: the package's `Algorithm` is a `const enum`, which TS
  // forbids referencing under this repo's `verbatimModuleSyntax` + `isolatedModules` settings.
  algorithm: 2,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2ID_PARAMS);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  // Only accept hashes in our own argon2id variant. The library's verify() takes the variant
  // and cost parameters from the stored string, so an argon2i/argon2d hash would be verified
  // with those instead of our policy. Rejecting anything that is not argon2id keeps
  // verification bound to our parameters; rehash-on-login is a later concern.
  if (!hashValue.startsWith("$argon2id$")) {
    return false;
  }

  try {
    // Constant-time comparison; the algorithm comes from the encoded hash, not from here.
    return await verify(hashValue, plain);
  } catch {
    // Malformed or unsupported hash: treat as "does not match", never throw.
    return false;
  }
}
