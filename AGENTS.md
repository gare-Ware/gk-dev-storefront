<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in this repo

Plan and technical reference live in `~/Developer/docs/` (`omen-storefront-plan-v2.md`, `headless-storefront-build-guide.md`). Read the plan's working loop before starting a run.

- Verify schema claims against `types/storefront-2026-07.schema.json`, including `isDeprecated`. Never from memory.
- After editing any `#graphql` query, run `pnpm codegen` and commit `types/`.
- Before presenting work: `pnpm codegen && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`. Shopify-backed routes must print `ƒ (Dynamic)` in the build output.
- Append every decision to `docs/decisions.md` with the alternative rejected and why.
- Do not push or open a PR until Gary has reviewed the result locally.
