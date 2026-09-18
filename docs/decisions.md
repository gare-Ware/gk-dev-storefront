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

## 2026-09-17 — Run 1.1 catalogue-seed

- **Gate 1 defaults accepted by Gary:** Admin access via the existing Dev Dashboard app, procedural images, delete the snowboard test data.
- **Admin auth is the client-credentials grant** with the app's client ID and secret from `.env.local`; the token lives 24 hours and is not stored. Rejected: a static `SHOPIFY_ADMIN_ACCESS_TOKEN` plus the setup wizard the plan proposed. Reason: the credentials already existed; a wizard would have set up something that was already done. A static token is still accepted if set.
- **Admin queries are hand-typed; the Admin schema is not in codegen.** Rejected: a second codegen project for the Admin API. Reason: it would commit a multi-megabyte schema for one script. Cost: a wrong field fails at runtime, not at `pnpm codegen`. Mitigation: every input type was introspected from the live 2026-07 schema while writing, and the script was run against the store.
- **`productSet` creates each product in one synchronous call** with options, variants, prices, inventory, and files. Rejected: `productCreate` + `productVariantsBulkCreate` + `productCreateMedia`. Reason: three mutations and three failure points per product for the same result.
- **Idempotency is delete-then-create by the `omen-seed` tag, plus a direct lookup of every catalogue handle.** Rejected: tag search alone. Reason: the search index lags writes; the second full run missed a product created a minute earlier and failed on "handle already in use". Rejected: `productSet` upsert by handle. Reason: a fresh create is easier to reason about than partial update semantics for files and variants. A product with a catalogue handle but no seed tag makes the run fail rather than delete it.
- **Inventory is stocked at the first location only.** Rejected: every location. Reason: the store has two, and the total showed double the catalogue number. Sold-out variants still resolve as sold out.
- **Images: SVG per motif, rasterised by resvg to 1200 × 1500 PNG, seeded by handle plus index.** Rejected: headless Chrome as the brand lab does (40 s per build) and `sharp` (native build, disabled in `pnpm-workspace.yaml`). No text is drawn, so no fonts are needed and output is identical across machines. Cost: film grain does not compress, so each PNG is about 3 MB and a full run uploads about 90 MB; Shopify's CDN serves resized versions.
- **Palettes vary per product** (five grounds, chosen by handle hash, a few forced by motif). Reason: one brand palette in every image would tune the design to gold-on-black before Gate 2b.
- **The flat mark is copied into `scripts/art/omen-mark.svg`** from the brand kit. Re-copy when the mark changes; the header mark in run 3.1 gets its own copy under `public/`.
- **Collections use the 2026-07 `sources` model.** `all` is a tag condition; `featured` is explicit selections. Both are deleted and re-created each run. Rule collections sort oldest-first so the catalogue's order shows. Note: `collectionCreate` now takes `collection:` and `CollectionCreateInput` has no `products` or `ruleSet`; `collectionByHandle` and `productByHandle` are gone, replaced by `*ByIdentifier`.
- **Publishing goes to every publication**, which is what the admin UI does for a new product. Rejected: only the Headless publication. Reason: publications have no name field, only a catalog title, so picking one is a guess.
- **Blocked: the app lacks `write_publications`.** Products and collections are created but invisible to the Storefront API. Confirmed twice: a probe product was invisible after `productCreate`, and `published: true` on `ProductVariantSetInput` does not publish either. Gate 1.1 therefore reopens for one scope. Until then the snowboards stay, so the live site keeps showing products; `--wipe-others` is a flag, not the default.
- **Scripts run on Node 24's built-in type stripping.** Rejected: adding `tsx`. Reason: zero dependencies; the cost is `.ts` import extensions (`allowImportingTsExtensions` in tsconfig) and a `scripts/package.json` declaring ESM so Node stops warning.
- **e2e tests re-pointed at seeded handles** and two cases added (a sold-out combination is unavailable, a sold-out product says so). They still skip on 404 so an unseeded store does not fail CI.
