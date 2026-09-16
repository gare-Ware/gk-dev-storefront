# Decision log

One entry per decision, dated. Gate outcomes and agent-made choices both go here, each with the alternative rejected and why. Raw material for the written breakdown.

## 2026-09-15 — Plan v2

- **Steering model adopted.** Gary directs; agent builds and verifies; decisions batch into gates. Rejected: continuing the hand-build session plan. Reason: Gary's working approach changed and the old plan optimised for learning by hand.
- **Brand is Omen.** Palette not final; nothing hardcodes gold-on-black. Rejected: an invented brand. Reason: the mark and kit already exist.
- **Filler catalogue seeded by script**, ambiguous objects adjacent to Omen's subject matter. Rejected: keeping snowboard test data. Reason: landscape imagery and board variants would tune the design to the wrong data.
- **Review loop: local review before any PR.** Rejected: push-first. Reason: token cost when a result is far off. Revisit once the loop is trusted.

## 2026-09-15 — Run 0.1 repo-hygiene

- **Unit tests with vitest, node environment, `lib/` only.** Rejected: jsdom plus React Testing Library. Reason: every route is an async Server Component, which vitest cannot render; Playwright covers routes. Add jsdom only if a client component earns it.
- **Playwright runs against the dev server locally and the production build in CI.** Reason: local speed vs. CI fidelity to what Vercel ships.
- **CI checks codegen output is committed and unchanged.** Reason: the type registry is keyed on exact query text, so a stale `types/` is a silent type lie.
- **CI asserts Shopify routes stay dynamic** by grepping the build output. Reason: losing `cache: "no-store"` would freeze product data into the build with no failing test.
- **`formatMoney` moved to `lib/shopify/money.ts`.** Reason: first shared helper, first unit test, and every surface will need it.
- **Root metadata is a placeholder** (`Omen`). Real metadata and OG images land in run 3.1.
