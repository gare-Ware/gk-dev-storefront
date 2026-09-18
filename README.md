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

# Only for `pnpm seed` (Admin API; see Catalogue below)
SHOPIFY_ADMIN_CLIENT_ID=…
SHOPIFY_ADMIN_CLIENT_SECRET=…
```

The tokens are server-only. No `NEXT_PUBLIC_` prefix, ever. The Admin credentials can delete the whole catalogue; only the seed script reads them.

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
| `pnpm seed` | Push `scripts/catalogue.json` into the store: wipe what it seeded before, re-create products, images, collections, publish. `--check` reports scopes; `--dry-run` prints the plan; `--only <handle>` does one product and rebuilds the list collections naming it; `--wipe-others` also deletes products it did not seed. |
| `pnpm art` | Render the procedural product images to `scripts/art-out/` without touching the store. |

## Catalogue

The store's products are filler, defined in `scripts/catalogue.json` and seeded by `pnpm seed`. The file is the source of truth: edit it and re-run. Real products go in the same file and replace the filler through the same script.

- Every seeded product carries the tag `omen-seed`; a run deletes those first, then re-creates everything, so runs are repeatable.
- Images are generated procedurally per product (deterministic: same handle, same image) and uploaded as 4:5 PNGs. Replace any image in the Shopify admin if you want a different one.
- Collections: `all` (rule: the seed tag) and `featured` (an explicit list), both re-created each run.
- The Admin app needs the scopes `write_products`, `write_inventory`, `write_files`, and `write_publications`. Without the last one products are created but never published to the Headless channel, so the storefront cannot see them. `pnpm seed --check` says which are missing.

## Layout

```
app/                  routes (async Server Components; one colocated query per route)
lib/shopify/client.ts shopifyFetch — typed by codegen from the exact query string
lib/shopify/*.ts      pure helpers with unit tests beside them
e2e/                  Playwright smoke tests
scripts/              catalogue.json, the seed script, the art generator (unit tests beside them)
types/                committed schema + generated types (read, don't edit)
docs/decisions.md     decision log, appended every run
```

## Planning docs

Live outside the repo in `~/Developer/docs/`: `omen-storefront-plan-v2.md` (the plan), `headless-storefront-build-guide.md` (technical reference), `variant-resolution-spec.md`.
