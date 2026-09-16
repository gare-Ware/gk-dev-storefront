import { describe, expect, it } from "vitest";
import {
  hasRealOptions,
  matchVariant,
  optionValueState,
  selectionFromParams,
  selectionToParams,
  toSelection,
  type VariantLike,
} from "./variants";

// A tee in two colours and three sizes, with gaps and a sold-out cell:
//   Black: S ✓  M ✓  L ✗(sold out)
//   White: S ✓  M —  L —          (no White/M or White/L variants exist)
const v = (
  id: string,
  Color: string,
  Size: string,
  availableForSale = true
): VariantLike => ({
  id,
  availableForSale,
  selectedOptions: [
    { name: "Color", value: Color },
    { name: "Size", value: Size },
  ],
});

const tee: VariantLike[] = [
  v("bs", "Black", "S"),
  v("bm", "Black", "M"),
  v("bl", "Black", "L", false),
  v("ws", "White", "S"),
];

describe("toSelection", () => {
  it("maps option names to values and trims", () => {
    expect(
      toSelection([
        { name: " Color", value: "Black " },
        { name: "Size", value: "M" },
      ])
    ).toEqual({ Color: "Black", Size: "M" });
  });
});

describe("matchVariant", () => {
  it("finds the variant matching every option", () => {
    expect(matchVariant(tee, { Color: "Black", Size: "M" })?.id).toBe("bm");
  });

  it("matches nothing on a partial selection", () => {
    expect(matchVariant(tee, { Color: "Black" })).toBeUndefined();
  });

  it("matches nothing on a nonexistent combination", () => {
    expect(matchVariant(tee, { Color: "White", Size: "L" })).toBeUndefined();
  });

  it("is case-sensitive, matching Shopify's server default", () => {
    expect(matchVariant(tee, { Color: "black", Size: "M" })).toBeUndefined();
  });

  it("ignores extra keys that are not options", () => {
    expect(
      matchVariant(tee, { Color: "Black", Size: "S", utm: "x" })?.id
    ).toBe("bs");
  });
});

describe("selectionFromParams", () => {
  it("keeps only known option names", () => {
    const params = new URLSearchParams("Color=Black&Size=M&utm_source=x");
    expect(selectionFromParams(["Color", "Size"], params)).toEqual({
      Color: "Black",
      Size: "M",
    });
  });

  it("passes unknown values through untouched (the matcher decides)", () => {
    const params = new URLSearchParams("Color=Purple");
    expect(selectionFromParams(["Color", "Size"], params)).toEqual({
      Color: "Purple",
    });
  });

  it("drops empty values", () => {
    const params = new URLSearchParams("Color=&Size=M");
    expect(selectionFromParams(["Color", "Size"], params)).toEqual({ Size: "M" });
  });
});

describe("selectionToParams", () => {
  it("emits keys in a stable sorted order", () => {
    expect(selectionToParams({ Size: "M", Color: "Black" }).toString()).toBe(
      "Color=Black&Size=M"
    );
  });

  it("round-trips through selectionFromParams", () => {
    const sel = { Color: "Black", Size: "M" };
    expect(
      selectionFromParams(["Color", "Size"], selectionToParams(sel))
    ).toEqual(sel);
  });
});

describe("optionValueState", () => {
  it("is available when an in-stock variant matches the hypothetical", () => {
    expect(optionValueState(tee, { Color: "Black" }, "Size", "M")).toBe(
      "available"
    );
  });

  it("is unavailable when only sold-out variants match", () => {
    expect(optionValueState(tee, { Color: "Black" }, "Size", "L")).toBe(
      "unavailable"
    );
  });

  it("is nonexistent when no variant has the combination", () => {
    expect(optionValueState(tee, { Color: "White" }, "Size", "M")).toBe(
      "nonexistent"
    );
  });

  it("ignores options with no selection yet", () => {
    // Nothing chosen: every colour has at least one in-stock variant.
    expect(optionValueState(tee, {}, "Color", "White")).toBe("available");
    // Size L exists only in Black, and that one is sold out.
    expect(optionValueState(tee, {}, "Size", "L")).toBe("unavailable");
  });

  it("replaces the current value of the option being evaluated", () => {
    // Currently White/S; asking about Color=Black should evaluate Black/S.
    expect(
      optionValueState(tee, { Color: "White", Size: "S" }, "Color", "Black")
    ).toBe("available");
  });

  it("degrades to nonexistent for an unknown value, never throws", () => {
    expect(optionValueState(tee, {}, "Color", "Purple")).toBe("nonexistent");
  });
});

describe("hasRealOptions", () => {
  it("is false for Shopify's single-variant placeholder option", () => {
    expect(
      hasRealOptions([{ name: "Title", optionValues: [{ name: "Default Title" }] }])
    ).toBe(false);
  });

  it("is true for a real option, even one named Title", () => {
    expect(
      hasRealOptions([
        { name: "Title", optionValues: [{ name: "Sample" }, { name: "Full" }] },
      ])
    ).toBe(true);
  });

  it("is true for any multi-option product", () => {
    expect(
      hasRealOptions([
        { name: "Color", optionValues: [{ name: "Black" }] },
        { name: "Size", optionValues: [{ name: "M" }] },
      ])
    ).toBe(true);
  });

  it("is false for no options at all", () => {
    expect(hasRealOptions([])).toBe(false);
  });
});
