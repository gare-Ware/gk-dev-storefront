import { describe, expect, it } from "vitest";
import {
  cartesian,
  descriptionHtml,
  expandVariants,
  readCatalogue,
  validateCatalogue,
  type Catalogue,
  type CatalogueProduct,
} from "./catalogue.ts";

const defaults = { inventory: 24, images: 3 };

const tee: CatalogueProduct = {
  handle: "tee",
  title: "Tee",
  productType: "T-shirt",
  tags: ["apparel"],
  description: "A tee.",
  details: ["Cotton"],
  options: [
    { name: "Size", values: ["S", "M"] },
    { name: "Color", values: ["Black", "Bone"] },
  ],
  price: "38.00",
  variants: [
    { options: { Size: "S", Color: "Bone" }, inventory: 0 },
    { options: { Size: "M" }, price: "40.00" },
  ],
  images: { count: 3, motif: "serpent-small" },
};

const single: CatalogueProduct = {
  handle: "deck",
  title: "Deck",
  productType: "Cards",
  tags: [],
  description: "Cards.",
  details: [],
  price: "18.00",
  compareAtPrice: "22.00",
  inventory: 0,
  images: { count: 1, motif: "five-symbols" },
};

const catalogue: Catalogue = {
  vendor: "Omen",
  currency: "USD",
  seedTag: "omen-seed",
  imageAspect: "4:5",
  defaults,
  collections: [
    { handle: "all", title: "All", rule: { tag: "omen-seed" } },
    { handle: "featured", title: "Featured", products: ["tee"] },
  ],
  products: [tee, single],
};

describe("cartesian", () => {
  it("varies the first list slowest", () => {
    expect(cartesian([["S", "M"], ["Black", "Bone"]])).toEqual([
      ["S", "Black"],
      ["S", "Bone"],
      ["M", "Black"],
      ["M", "Bone"],
    ]);
  });

  it("yields one empty combination for no lists", () => {
    expect(cartesian([])).toEqual([[]]);
  });
});

describe("expandVariants", () => {
  it("builds the full grid with product-level defaults", () => {
    const variants = expandVariants(tee, defaults);
    expect(variants).toHaveLength(4);
    expect(variants[0]).toEqual({
      title: "S / Black",
      optionValues: [
        { optionName: "Size", name: "S" },
        { optionName: "Color", name: "Black" },
      ],
      price: "38.00",
      compareAtPrice: undefined,
      inventory: 24,
    });
  });

  it("applies exact and partial overrides", () => {
    const byTitle = Object.fromEntries(expandVariants(tee, defaults).map((v) => [v.title, v]));
    expect(byTitle["S / Bone"].inventory).toBe(0);
    expect(byTitle["M / Black"].price).toBe("40.00");
    expect(byTitle["M / Bone"].price).toBe("40.00");
    expect(byTitle["S / Black"].price).toBe("38.00");
  });

  it("yields one Default Title variant for a product without options", () => {
    expect(expandVariants(single, defaults)).toEqual([
      { title: "Default Title", optionValues: [], price: "18.00", compareAtPrice: "22.00", inventory: 0 },
    ]);
  });
});

describe("descriptionHtml", () => {
  it("renders a paragraph and a details list, escaped", () => {
    expect(descriptionHtml({ ...single, description: "Cards & <more>", details: ['"Five"'] })).toBe(
      '<p>Cards &amp; &lt;more&gt;</p>\n<ul>\n  <li>&quot;Five&quot;</li>\n</ul>'
    );
  });

  it("omits the list when there are no details", () => {
    expect(descriptionHtml(single)).toBe("<p>Cards.</p>");
  });
});

describe("validateCatalogue", () => {
  it("accepts a well-formed catalogue", () => {
    expect(validateCatalogue(catalogue)).toEqual({ errors: [], warnings: [] });
  });

  it.each<[string, Partial<CatalogueProduct>, RegExp]>([
    ["bad handle", { handle: "Bad Handle" }, /handle must be lowercase/],
    ["bad price", { price: "38" }, /price "38" must look like/],
    ["compare-at below price", { compareAtPrice: "30.00" }, /compareAtPrice must exceed price/],
    ["reserved option", { options: [{ name: "Title", values: ["Default Title"] }] }, /reserved option/],
    ["repeated value", { options: [{ name: "Size", values: ["S", "S"] }] }, /repeats a value/],
    ["unknown override option", { variants: [{ options: { Fit: "Slim" } }] }, /unknown option "Fit"/],
    ["unknown override value", { variants: [{ options: { Size: "XL" } }] }, /unknown value "XL"/],
    ["no images", { images: { count: 0, motif: "prism" } }, /images.count/],
  ])("rejects %s", (_name, patch, message) => {
    const { errors } = validateCatalogue({ ...catalogue, products: [{ ...tee, ...patch }] , collections: [] });
    expect(errors.join("\n")).toMatch(message);
  });

  it("rejects duplicate handles and dangling collection references", () => {
    const { errors } = validateCatalogue({
      ...catalogue,
      products: [tee, { ...single, handle: "tee" }],
      collections: [{ handle: "featured", title: "Featured", products: ["ghost"] }],
    });
    expect(errors).toContain('product "tee": duplicate handle');
    expect(errors).toContain('collection "featured": unknown product "ghost"');
  });

  it("warns, not errors, above the PDP fetch limit", () => {
    const big: CatalogueProduct = {
      ...tee,
      variants: [],
      options: [
        { name: "Size", values: ["1", "2", "3", "4", "5", "6", "7"] },
        { name: "Color", values: ["A", "B", "C"] },
      ],
    };
    const { errors, warnings } = validateCatalogue({ ...catalogue, products: [big], collections: [] });
    expect(errors).toEqual([]);
    expect(warnings[0]).toMatch(/21 variants exceeds the 20/);
  });
});

describe("scripts/catalogue.json", () => {
  it("is valid and matches the gate 1 mix", () => {
    const { catalogue, warnings } = readCatalogue();
    expect(warnings).toEqual([]);
    const withOptions = catalogue.products.filter((p) => p.options?.length);
    const singles = catalogue.products.filter((p) => !p.options?.length);
    expect(catalogue.products.length).toBeGreaterThanOrEqual(10);
    expect(withOptions.length).toBeGreaterThanOrEqual(6);
    expect(singles.length).toBeGreaterThanOrEqual(3);
    // At least one two-axis product, so the selector's "unavailable" state exists.
    expect(withOptions.some((p) => (p.options?.length ?? 0) >= 2)).toBe(true);
  });
});
