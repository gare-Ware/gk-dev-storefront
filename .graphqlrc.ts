import { ApiType, shopifyApiProject } from "@shopify/api-codegen-preset";

// The Storefront schema is fetched from Shopify's public proxy for this exact
// API version — no token required. Keep `apiVersion` in lockstep with
// SHOPIFY_API_VERSION in .env.local, or you generate types for a schema you
// aren't querying.
const config = {
  projects: {
    // Must be named `default` — graphql-codegen looks up that key unless
    // you pass --project on every invocation.
    default: shopifyApiProject({
      apiType: ApiType.Storefront,
      apiVersion: "2026-07",
      documents: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
      outputDir: "./types",
      // Default targets @shopify/storefront-api-client, which we don't use.
      // Point the generated `declare module` at our own client so the query
      // registry augments an interface we control.
      module: "@/lib/shopify/client",
    }),
  },
};

export default config;
