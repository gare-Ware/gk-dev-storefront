# Omen storefront

Headless Shopify storefront for the Omen brand. Next.js App Router, TypeScript, Tailwind v4, Storefront API `2026-07`, Shopify hosted checkout, deployed on Vercel.

Live: https://gk-dev-storefront.vercel.app

## Run it

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

`.env.local` (never committed):

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=shpat_…
SHOPIFY_API_VERSION=2026-07
```

The token is server-only. No `NEXT_PUBLIC_` prefix, ever.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on :3000 |
| `pnpm codegen` | Regenerate typed queries from the Storefront schema. Run after editing any `#graphql` query. |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (vitest) for pure modules in `lib/` |
| `pnpm test:e2e` | Playwright smoke tests against a running or auto-started dev server |
| `pnpm build` | Production build. Shopify-backed routes must print `ƒ (Dynamic)`. |

## Layout

```
app/                  routes (async Server Components; one colocated query per route)
lib/shopify/client.ts shopifyFetch — typed by codegen from the exact query string
lib/shopify/*.ts      pure helpers with unit tests beside them
e2e/                  Playwright smoke tests
types/                committed schema + generated types (read, don't edit)
docs/decisions.md     decision log, appended every run
```

## Planning docs

Live outside the repo in `~/Developer/docs/`: `omen-storefront-plan-v2.md` (the plan), `headless-storefront-build-guide.md` (technical reference), `variant-resolution-spec.md`.
