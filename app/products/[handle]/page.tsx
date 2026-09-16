import { notFound } from "next/navigation";
import Image from "next/image";
import { shopifyFetch } from "@/lib/shopify/client";
import { formatMoney } from "@/lib/shopify/money";

// `values` on ProductOption is deprecated in 2026-07 — use `optionValues`.
const QUERY = `#graphql
  query Product($handle: String!) {
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
      variants(first: 20) {
        nodes {
          id
          title
          availableForSale
          price { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
  }
`;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const { product } = await shopifyFetch(QUERY, { handle });

  if (!product) notFound();

  const [firstImage] = product.images.nodes;

  return (
    <main>
      <h1>{product.title}</h1>
      <p>{formatMoney(product.priceRange.minVariantPrice)}</p>

      {firstImage && (
        <Image
          src={firstImage.url}
          alt={firstImage.altText ?? product.title}
          width={firstImage.width ?? 1200}
          height={firstImage.height ?? 1200}
        />
      )}

      {/* descriptionHtml is merchant-authored HTML. It is trusted here because
          this store's admin is the only author; a multi-tenant build would
          need to sanitise it. */}
      <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />

      {product.options.map((option) => (
        <section key={option.id}>
          <h2>{option.name}</h2>
          <ul>
            {option.optionValues.map((value) => (
              <li key={value.id}>{value.name}</li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2>Variants</h2>
        <ul>
          {product.variants.nodes.map((variant) => (
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
