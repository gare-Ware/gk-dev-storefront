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

## 2026-09-16 — CI fixes after first merge

- **`typecheck` runs `next typegen` first.** Reason: Next's global route helpers (`LayoutProps`, `PageProps`) are emitted into `.next/types` by dev/build; a clean CI runner has none, so bare `tsc` failed. Rejected: running a full build before typecheck. Reason: slower, and typegen exists for exactly this.
- **e2e job skips with a warning when Storefront secrets are absent.** Rejected: failing the job. Reason: an empty domain produced a confusing DNS error; a warning names the real cause and keeps PRs green until the secrets exist.
- **Stacked PR #4 was closed by GitHub** when its base branch was deleted on merge. Re-opened as #5. Lesson: do not delete a branch that another PR targets. Prefer branching from `main` and waiting, or merge the stack top-down.

## 2026-09-17 — Gate 1.2 product concepts (proposed, awaiting Gary)

- **Concepts live in `scripts/catalogue.json`**, the file run 1.1 reads, not in a separate doc. Rejected: a markdown list Gary edits and the agent transcribes. Reason: one source; edits go straight into what the seed script consumes.
- **11 products: 4 apparel, 3 prints, 4 single-variant objects.** Rejected: padding to 12. Reason: the mix is what matters; every path the selector, aspect token, and single-variant route need is covered.
- **Two apparel items carry a second `Color` axis** (tee, hoodie), two are size-only. Rejected: size-only across all four as the plan literally says. Reason: `optionValueState` has an unavailable state that only a two-axis product can produce; the plan's own test data (`?Color=Dawn`) assumes a colour axis exists.
- **Sold-out placements chosen to hit each selector path:** two colour-and-size combinations on the tee and hoodie (unavailable, not nonexistent), one print size, and one single-variant object sold out entirely (the single-variant sold-out PDP, which the snowboard test data covered with "The Out of Stock Snowboard").
- **Compare-at price on one selector product and one single-variant product** (long sleeve, log). Reason: run 0.2 already renders `compareAtPrice`; both PDP shapes should show it.
- **Awkward option values on purpose:** `S/M` and `L/XL` on the socks, `12 × 16 in` on prints. Reason: a slash and a non-ASCII character in a value are what break URL-as-state selectors; filler data should catch that before real data does.
- **Print prices vary by size** through per-variant overrides. Reason: gives the price a reason to change on selection, which the motion table's price crossfade needs.
- **Description split into a one-line `description` and a `details` list.** Reason: cards and metadata need one line; the PDP description typography in run 3.2 needs a paragraph plus a list to style.
- **Two collections: `all` (rule: seed tag) and `featured` (six handles).** Rejected: per-type collections. Reason: plan asks for two or three; per-type navigation is not in v1 scope.
- **Prices in USD, sizes in inches.** Reason: `shop.paymentSettings.currencyCode` is USD.
- **No brand colour named in copy.** Reason: palette is not final.
- **Gate 1.1 looks done already:** `.env.local` holds `SHOPIFY_ADMIN_CLIENT_ID` and `SHOPIFY_ADMIN_CLIENT_SECRET`. Run 1.1 should exchange those for an access token (client-credentials grant) rather than expect a static `SHOPIFY_ADMIN_ACCESS_TOKEN`; the plan's wizard is unnecessary unless scopes are missing.
