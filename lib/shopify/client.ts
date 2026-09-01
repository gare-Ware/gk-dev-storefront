const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN!;
const version = process.env.SHOPIFY_API_VERSION!;

const endpoint = `https://${domain}/api/${version}/graphql.json`;

/**
 * Registry of every `#graphql`-tagged query in the codebase, keyed by its exact
 * source string. Deliberately empty here — `pnpm codegen` fills it in via a
 * module augmentation in types/storefront.generated.d.ts. That is what lets
 * shopifyFetch infer its return type from the query you pass it.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StorefrontQueries {}

type QueryReturn<Q extends keyof StorefrontQueries> =
  StorefrontQueries[Q] extends { return: infer R } ? R : never;

type QueryVariables<Q extends keyof StorefrontQueries> =
  StorefrontQueries[Q] extends { variables: infer V } ? V : never;

// Server-only. The private token must never reach the browser.
export async function shopifyFetch<Q extends keyof StorefrontQueries>(
  query: Q,
  variables?: QueryVariables<Q>
): Promise<QueryReturn<Q>> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Shopify-Storefront-Private-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    // Forces dynamic rendering: without this Next prerenders the route at
    // build time and the product list is frozen until the next deploy.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Shopify responded ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    throw new Error("Shopify query failed");
  }
  return json.data as QueryReturn<Q>;
}
