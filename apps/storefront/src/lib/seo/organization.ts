// The home page's structured data (ARCHITECTURE §10.14): a schema.org `Organization`. Serialize it
// with `serializeJsonLd` from `@/lib/catalog/json-ld`.

export type OrganizationJsonLd = {
  "@context": string;
  "@type": "Organization";
  name: string;
  url: string;
};

export function buildOrganizationJsonLd(name: string, baseUrl: string): OrganizationJsonLd {
  return { "@context": "https://schema.org", "@type": "Organization", name, url: baseUrl };
}
