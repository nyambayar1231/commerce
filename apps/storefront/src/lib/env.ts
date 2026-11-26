import "server-only";

// Runtime configuration of the storefront (ARCHITECTURE §10.13). Read on the server only, never
// through NEXT_PUBLIC_* variables, so one image runs everywhere. Validated once; an error names
// the variable and never echoes its value (values can be secrets in other deployments).

type Source = Record<string, string | undefined>;

export type Env = {
  apiUrl: string;
  storefrontUrl: string;
  trustProxy: boolean;
  imageOrigins: string[];
  paymentProviders: string[];
  /** The origin of Wire's hosted payment page; the only place a Wire payment may send a shopper. */
  wireCheckoutOrigin: string;
  production: boolean;
};

const PAYMENT_PROVIDERS = ["dummy", "wire"];

function isHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Parses `source` (normally process.env); throws one error listing every problem. */
export function parseEnv(source: Source): Env {
  const problems: string[] = [];
  const production = source.NODE_ENV === "production";

  const required = (name: string, devDefault: string): string => {
    const value = source[name]?.trim();
    if (value) return value;
    if (production) problems.push(`${name} is not set`);
    return devDefault;
  };

  const apiUrl = required("API_URL", "http://localhost:4000");
  if (!isHttpUrl(apiUrl)) problems.push("API_URL must be an absolute http(s) URL");
  else if (apiUrl.endsWith("/")) problems.push("API_URL must not end with a slash");

  const storefrontUrl = required("STOREFRONT_URL", "http://localhost:3000");
  const storefront = isHttpUrl(storefrontUrl);
  if (!storefront || storefront.origin !== storefrontUrl) {
    problems.push("STOREFRONT_URL must be an http(s) origin (scheme://host[:port], no path)");
  }

  const trust = source.TRUST_PROXY?.trim() || "false";
  if (trust !== "true" && trust !== "false") problems.push('TRUST_PROXY must be "true" or "false"');

  // Development defaults to the dev API (thumbnail URLs) and the local S3 server they redirect
  // to; CSP checks both. Production lists its own origins.
  const imageOrigins = list(
    source.IMAGE_ORIGINS ?? (production ? "" : "http://localhost:4000,http://localhost:8333"),
  );
  for (const origin of imageOrigins) {
    const url = isHttpUrl(origin);
    if (!url || url.origin !== origin) {
      problems.push("IMAGE_ORIGINS must be comma-separated http(s) origins (scheme://host[:port])");
      break;
    }
  }

  // The test payment marks orders paid without taking money: development only, unless a demo
  // allows it explicitly (the API refuses it in production the same way, ADR-0016).
  const paymentProviders = list(source.PAYMENT_PROVIDERS ?? (production ? "" : "dummy"));
  if (paymentProviders.some((name) => !PAYMENT_PROVIDERS.includes(name))) {
    problems.push(
      `PAYMENT_PROVIDERS has an unknown provider (allowed: ${PAYMENT_PROVIDERS.join(", ")})`,
    );
  }
  if (production && paymentProviders.includes("dummy") && source.ALLOW_DUMMY_PAYMENTS !== "true") {
    problems.push(
      'PAYMENT_PROVIDERS must not enable "dummy" in production (no money is taken); set ' +
        "ALLOW_DUMMY_PAYMENTS=true only for a demo",
    );
  }

  const wireCheckoutOrigin = source.WIRE_CHECKOUT_ORIGIN?.trim() || "https://pay.wire.mn";
  const wireCheckout = isHttpUrl(wireCheckoutOrigin);
  if (!wireCheckout || wireCheckout.origin !== wireCheckoutOrigin) {
    problems.push("WIRE_CHECKOUT_ORIGIN must be an http(s) origin (scheme://host[:port], no path)");
  }

  if (problems.length > 0) {
    throw new Error(`Invalid storefront configuration:\n- ${problems.join("\n- ")}`);
  }
  return {
    apiUrl,
    storefrontUrl,
    trustProxy: trust === "true",
    imageOrigins,
    paymentProviders,
    wireCheckoutOrigin,
    production,
  };
}

let cached: Env | undefined;

/** The validated environment, computed on first use. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
