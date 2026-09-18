/**
 * Pure catalogue logic for scripts/catalogue.json: types, validation, and the
 * expansion of a product's option grid into concrete variants. No Shopify
 * types and no network, so it is unit-tested in isolation.
 */
import { readFileSync } from "node:fs";

export type CatalogueOption = { name: string; values: string[] };

/**
 * Overrides for the variants matching `options`. A partial selection (say only
 * `{ Size: "XXL" }`) applies to every variant with that value.
 */
export type VariantOverride = {
  options: Record<string, string>;
  price?: string;
  compareAtPrice?: string;
  inventory?: number;
};

export type CatalogueProduct = {
  handle: string;
  title: string;
  productType: string;
  tags: string[];
  description: string;
  details: string[];
  edition?: number;
  options?: CatalogueOption[];
  price: string;
  compareAtPrice?: string;
  inventory?: number;
  variants?: VariantOverride[];
  images: { count: number; motif: string };
};

export type CatalogueCollection = {
  handle: string;
  title: string;
  /** Rule-based membership: every product carrying this tag. */
  rule?: { tag: string };
  /** Explicit membership, by product handle, in display order. */
  products?: string[];
};

export type Catalogue = {
  vendor: string;
  currency: string;
  seedTag: string;
  imageAspect: string;
  defaults: { inventory: number; images: number };
  collections: CatalogueCollection[];
  products: CatalogueProduct[];
};

export type ExpandedVariant = {
  /** Shopify's variant title: option values joined by " / ". */
  title: string;
  optionValues: { optionName: string; name: string }[];
  price: string;
  compareAtPrice?: string;
  inventory: number;
};

/** Every combination of one value per list, first list varying slowest. */
export function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((value) => [...prefix, value])),
    [[]]
  );
}

/**
 * The full variant grid for a product with product-level price/inventory
 * applied, then per-combination overrides. A product with no options yields
 * one variant, titled "Default Title" as Shopify does.
 */
export function expandVariants(
  product: CatalogueProduct,
  defaults: Catalogue["defaults"]
): ExpandedVariant[] {
  const options = product.options ?? [];
  return cartesian(options.map((o) => o.values)).map((combo) => {
    const optionValues = combo.map((name, i) => ({ optionName: options[i].name, name }));
    const overrides = (product.variants ?? []).filter((v) =>
      Object.entries(v.options).every(([name, value]) =>
        optionValues.some((ov) => ov.optionName === name && ov.name === value)
      )
    );
    const merged = Object.assign({}, ...overrides) as VariantOverride;
    return {
      title: combo.length ? combo.join(" / ") : "Default Title",
      optionValues,
      price: merged.price ?? product.price,
      compareAtPrice: merged.compareAtPrice ?? product.compareAtPrice,
      inventory: merged.inventory ?? product.inventory ?? defaults.inventory,
    };
  });
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** One paragraph plus a details list: what the PDP's description typography styles. */
export function descriptionHtml(product: CatalogueProduct): string {
  const paragraph = `<p>${escapeHtml(product.description)}</p>`;
  if (!product.details.length) return paragraph;
  const items = product.details.map((d) => `  <li>${escapeHtml(d)}</li>`).join("\n");
  return `${paragraph}\n<ul>\n${items}\n</ul>`;
}

export type Validation = { errors: string[]; warnings: string[] };

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONEY = /^\d+\.\d{2}$/;

/** Shopify caps a product at 100 variants; the PDP query fetches the first 20. */
export const SHOPIFY_VARIANT_LIMIT = 100;
export const PDP_VARIANT_FETCH = 20;

export function validateCatalogue(catalogue: Catalogue): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const handles = new Set<string>();

  if (!catalogue.seedTag) errors.push("seedTag is required");

  for (const p of catalogue.products) {
    const at = `product "${p.handle}"`;
    if (!HANDLE.test(p.handle)) errors.push(`${at}: handle must be lowercase words joined by hyphens`);
    if (handles.has(p.handle)) errors.push(`${at}: duplicate handle`);
    handles.add(p.handle);
    if (!p.title?.trim()) errors.push(`${at}: title is required`);
    if (!MONEY.test(p.price)) errors.push(`${at}: price "${p.price}" must look like "12.00"`);
    if (p.compareAtPrice !== undefined && !MONEY.test(p.compareAtPrice)) {
      errors.push(`${at}: compareAtPrice "${p.compareAtPrice}" must look like "12.00"`);
    }
    if (!Number.isInteger(p.images?.count) || p.images.count < 1) {
      errors.push(`${at}: images.count must be a positive integer`);
    }
    if (!p.images?.motif) errors.push(`${at}: images.motif is required`);

    const options = p.options ?? [];
    const names = new Set<string>();
    for (const o of options) {
      if (names.has(o.name)) errors.push(`${at}: duplicate option "${o.name}"`);
      names.add(o.name);
      if (o.name === "Title") errors.push(`${at}: "Title" is Shopify's reserved option name; omit options for a single-variant product`);
      if (!o.values.length) errors.push(`${at}: option "${o.name}" has no values`);
      if (new Set(o.values).size !== o.values.length) errors.push(`${at}: option "${o.name}" repeats a value`);
    }

    for (const v of p.variants ?? []) {
      for (const [name, value] of Object.entries(v.options)) {
        const option = options.find((o) => o.name === name);
        if (!option) errors.push(`${at}: override refers to unknown option "${name}"`);
        else if (!option.values.includes(value)) {
          errors.push(`${at}: override refers to unknown value "${value}" for option "${name}"`);
        }
      }
      if (v.price !== undefined && !MONEY.test(v.price)) errors.push(`${at}: override price "${v.price}" must look like "12.00"`);
      if (v.compareAtPrice !== undefined && !MONEY.test(v.compareAtPrice)) {
        errors.push(`${at}: override compareAtPrice "${v.compareAtPrice}" must look like "12.00"`);
      }
    }

    const count = options.reduce((n, o) => n * o.values.length, 1);
    if (count > SHOPIFY_VARIANT_LIMIT) {
      errors.push(`${at}: ${count} variants exceeds Shopify's limit of ${SHOPIFY_VARIANT_LIMIT}`);
    } else if (count > PDP_VARIANT_FETCH) {
      warnings.push(`${at}: ${count} variants exceeds the ${PDP_VARIANT_FETCH} the PDP query fetches; raise variants(first:) in app/products/[handle]/page.tsx`);
    }

    if (!errors.some((e) => e.startsWith(at))) {
      for (const v of expandVariants(p, catalogue.defaults)) {
        if (v.compareAtPrice !== undefined && Number(v.compareAtPrice) <= Number(v.price)) {
          errors.push(`${at}: variant "${v.title}" compareAtPrice must exceed price`);
        }
      }
    }
  }

  const collectionHandles = new Set<string>();
  for (const c of catalogue.collections) {
    const at = `collection "${c.handle}"`;
    if (!HANDLE.test(c.handle)) errors.push(`${at}: handle must be lowercase words joined by hyphens`);
    if (collectionHandles.has(c.handle)) errors.push(`${at}: duplicate handle`);
    collectionHandles.add(c.handle);
    if (!c.title?.trim()) errors.push(`${at}: title is required`);
    if (!c.rule && !c.products) errors.push(`${at}: needs a rule or a products list`);
    for (const h of c.products ?? []) {
      if (!handles.has(h)) errors.push(`${at}: unknown product "${h}"`);
    }
  }

  return { errors, warnings };
}

/** Reads and validates a catalogue file. Throws on validation errors. */
export function readCatalogue(path: string | URL = new URL("./catalogue.json", import.meta.url)): {
  catalogue: Catalogue;
  warnings: string[];
} {
  const catalogue = JSON.parse(readFileSync(path, "utf8")) as Catalogue;
  const { errors, warnings } = validateCatalogue(catalogue);
  if (errors.length) {
    throw new Error(`catalogue.json is invalid:\n  ${errors.join("\n  ")}`);
  }
  return { catalogue, warnings };
}
