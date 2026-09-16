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

## 2026-09-15 — Run 0.2 variant-resolution

- **Selection state lives in the URL** (`?Color=Dawn`), resolved server-side by `selectedOrFirstAvailableVariant` on first paint. Rejected: `useState` on the client. Reason: shareable, survives refresh, and the correct variant renders before hydration instead of flashing the default.
- **The page reasons about the resolved variant's selection, not the raw URL.** Reason: the server may correct an unknown or sold-out request; the option-state labels must agree with the price shown.
- **`ignoreUnknownOptions` left at its default `true`.** Rejected: `variantBySelectedOptions`. Reason: stale shared links degrade to a real variant instead of a null state to design around.
- **Matching is case-sensitive.** Reason: Shopify's server matchers default to `caseInsensitiveMatch: false`; client and server must agree.
- **`hasRealOptions` checks the value "Default Title", not the option name.** Reason: Shopify's own test data has a real option named "Title" with three values (`selling-plans-ski-wax`).
- **Three option-value states, none disabled.** Available, unavailable (sold out), nonexistent. Rendered as literal text for now; the real selector lands in run 3.4.
- **Truncation guard** logs when `variantsCount` exceeds the 20 fetched variants. Rejected: paginating variants now. Reason: no product needs it yet; the log makes the failure visible instead of silent.
- **`priority` on the first product image.** Reason: Next flagged it as the LCP element during e2e; it is the one image that should be eager.
- **e2e tests skip, not fail, when a test-data handle is gone.** Reason: the catalogue seed (run 1.1) will delete the snowboards; CI should not break on that.
