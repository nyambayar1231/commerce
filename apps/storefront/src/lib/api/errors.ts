// Mutation error codes (Saleor's `errors[].code`) → keys of the `errors` message namespace.
// Later steps extend the map.
export type ErrorKey = "required" | "invalid" | "notFound" | "unavailable" | "generic";

const KEYS: Record<string, ErrorKey> = {
  REQUIRED: "required",
  INVALID: "invalid",
  NOT_FOUND: "notFound",
};

export function errorMessageKey(code: string | undefined): ErrorKey {
  return code !== undefined && Object.hasOwn(KEYS, code) ? (KEYS[code] as ErrorKey) : "generic";
}
