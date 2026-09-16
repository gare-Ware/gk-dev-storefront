/**
 * Pure variant-matching logic. No React, no Shopify imports: structural types
 * so it works with whatever codegen produces and is portable to the cart.
 *
 * Matching is case-sensitive and whitespace-trimmed. Shopify's server-side
 * matchers (`selectedOrFirstAvailableVariant`, `variantBySelectedOptions`)
 * default to `caseInsensitiveMatch: false`, and the client must agree with
 * the server or the first paint and the first click disagree.
 */

export type SelectedOption = { name: string; value: string };

export type VariantLike = {
  id: string;
  availableForSale: boolean;
  selectedOptions: SelectedOption[];
};

export type OptionLike = {
  name: string;
  optionValues: { name: string }[];
};

/** Option name -> chosen value, e.g. `{ Color: "Black", Size: "M" }`. */
export type Selection = Record<string, string>;

/**
 * - `available`: a variant with this value plus the current other selections
 *   exists and is in stock
 * - `unavailable`: such a variant exists but is sold out
 * - `nonexistent`: no variant has this combination at all
 */
export type OptionValueState = "available" | "unavailable" | "nonexistent";

const clean = (s: string) => s.trim();

export function toSelection(options: SelectedOption[]): Selection {
  const selection: Selection = {};
  for (const { name, value } of options) selection[clean(name)] = clean(value);
  return selection;
}

/**
 * Exact match on every option the variant declares. A partial selection
 * matches nothing; use `optionValueState` to reason about partial selections.
 */
export function matchVariant<V extends VariantLike>(
  variants: V[],
  selection: Selection
): V | undefined {
  return variants.find((variant) =>
    variant.selectedOptions.every(
      ({ name, value }) => selection[clean(name)] === clean(value)
    )
  );
}

/** Keep only params whose key is a known option name; drop everything else. */
export function selectionFromParams(
  optionNames: string[],
  params: URLSearchParams
): Selection {
  const selection: Selection = {};
  for (const name of optionNames) {
    const value = params.get(name);
    if (value !== null && clean(value) !== "") selection[name] = clean(value);
  }
  return selection;
}

/** Stable key order so two equivalent selections produce comparable URLs. */
export function selectionToParams(selection: Selection): URLSearchParams {
  const params = new URLSearchParams();
  for (const name of Object.keys(selection).sort()) {
    params.set(name, selection[name]);
  }
  return params;
}

export function optionValueState(
  variants: VariantLike[],
  selection: Selection,
  optionName: string,
  value: string
): OptionValueState {
  const hypothetical: Selection = { ...selection, [optionName]: clean(value) };
  const candidates = variants.filter((variant) =>
    variant.selectedOptions.every(({ name, value: v }) => {
      const chosen = hypothetical[clean(name)];
      // Options with no selection yet don't constrain the match.
      return chosen === undefined || chosen === clean(v);
    })
  );
  if (candidates.length === 0) return "nonexistent";
  return candidates.some((v) => v.availableForSale) ? "available" : "unavailable";
}

/**
 * Shopify gives every product at least one option. A product with no real
 * choices has exactly one option named "Title" whose only value is
 * "Default Title". Render no selector for that shape.
 *
 * Note: an option *named* "Title" with real values is a legitimate option
 * (Shopify's own test data has one), so the check is on the value, not the name.
 */
export function hasRealOptions(options: OptionLike[]): boolean {
  if (options.length !== 1) return options.length > 1;
  const [only] = options;
  return !(
    only.name === "Title" &&
    only.optionValues.length === 1 &&
    only.optionValues[0].name === "Default Title"
  );
}
