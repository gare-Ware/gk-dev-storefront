const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN!;
const version = process.env.SHOPIFY_API_VERSION!;

const endpoint = `https://${domain}/api/${version}/graphql.json`;

// Server-only. The private token must never reach the browser.
export async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
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
  return json.data as T;
}
