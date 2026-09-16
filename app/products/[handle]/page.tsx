import { notFound } from "next/navigation";
import Image from "next/image";
import { shopifyFetch } from "@/lib/shopify/client";
import { formatMoney } from "@/lib/shopify/money";
import {
  hasRealOptions,
  optionValueState,
  selectionFromParams,
  toSelection,
} from "@/lib/shopify/variants";

// `values` on ProductOption is deprecated in 2026-07 — use `optionValues`.
//
// `selectedOrFirstAvailableVariant` always returns a variant when the product
// has any: the selection match, else the first available, else the first. Its
// `ignoreUnknownOptions` defaults to true, which is what lets a stale shared
// link like `?Color=Purple` degrade to a sensible variant instead of erroring.
// (Its strict sibling `variantBySelectedOptions` returns null on a miss.)
const QUERY = `#graphql
  query Product($handle: String!, $selectedOptions: [SelectedOptionInput!]) {
    product(handle: $handle) {
      id
      title
      descriptionHtml
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      images(first: 6) {
        nodes { id url altText width height }
      }
      options {
        id
        name
        optionValues { id name }
      }
      variantsCount { count }
      variants(first: 20) {
        nodes {
          id
          title
          availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
        }
      }
      selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions) {
        id
        title
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
`;

type SearchParams = Record<string, string | string[] | undefined>;

function toURLSearchParams(searchParams: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { handle } = await params;
  const rawParams = toURLSearchParams(await searchParams);

  // Every search param is forwarded as a candidate selection. Option names
  // arrive in the same response, so filtering here would need a second query;
  // `ignoreUnknownOptions` (default true) drops non-option keys server-side.
  const requested = Array.from(rawParams.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  const { product } = await shopifyFetch(QUERY, {
    handle,
    selectedOptions: requested.length ? requested : undefined,
  });

  if (!product) notFound();

  if (product.variantsCount && product.variantsCount.count > product.variants.nodes.length) {
    // `variants(first: 20)` truncates silently. The selector would appear to
    // work and be wrong for the missing combinations.
    console.warn(
      `[pdp] ${handle}: ${product.variantsCount.count} variants, fetched ${product.variants.nodes.length}`
    );
  }

  const optionNames = product.options.map((o) => o.name);
  const variants = product.variants.nodes;
  const resolved = product.selectedOrFirstAvailableVariant;
  const showSelector = hasRealOptions(product.options);

  // The selection the page reasons about is the resolved variant's, not the
  // raw URL's: the server may have corrected an unknown or unavailable request.
  const selection = resolved
    ? toSelection(resolved.selectedOptions)
    : selectionFromParams(optionNames, rawParams);

  const [firstImage] = product.images.nodes;

  return (
    <main>
      <h1>{product.title}</h1>

      {resolved ? (
        <p>
          {formatMoney(resolved.price)}
          {resolved.compareAtPrice &&
            Number(resolved.compareAtPrice.amount) > Number(resolved.price.amount) && (
              <>
                {" "}
                <s>{formatMoney(resolved.compareAtPrice)}</s>
              </>
            )}
          {!resolved.availableForSale && " (sold out)"}
        </p>
      ) : (
        <p>From {formatMoney(product.priceRange.minVariantPrice)}</p>
      )}

      {firstImage && (
        <Image
          src={firstImage.url}
          alt={firstImage.altText ?? product.title}
          width={firstImage.width ?? 1200}
          height={firstImage.height ?? 1200}
          // The only priority image on the page: it is the LCP element.
          priority
        />
      )}

      {/* descriptionHtml is merchant-authored HTML. It is trusted here because
          this store's admin is the only author; a multi-tenant build would
          need to sanitise it. */}
      <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />

      {showSelector &&
        product.options.map((option) => (
          <section key={option.id}>
            <h2>{option.name}</h2>
            {/* Ugly on purpose: literal state text proves the logic in the
                browser. Replaced by the real selector in run 3.4. */}
            <ul>
              {option.optionValues.map((value) => {
                const state = optionValueState(variants, selection, option.name, value.name);
                const selected = selection[option.name] === value.name;
                return (
                  <li key={value.id} data-option={option.name} data-value={value.name} data-state={state}>
                    {value.name} ({state}){selected && " ← selected"}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      <section>
        <h2>Variants</h2>
        <ul>
          {variants.map((variant) => (
            <li key={variant.id}>
              {variant.title} — {formatMoney(variant.price)}
              {!variant.availableForSale && " (sold out)"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
