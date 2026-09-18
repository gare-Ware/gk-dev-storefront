import { describe, expect, it } from "vitest";
import { readCatalogue } from "./catalogue.ts";
import { altText, artSvg, HEIGHT, MOTIFS, WIDTH } from "./generate-art.ts";

const spec = { handle: "witness-tee", title: "Witness Tee", motif: "serpent-small" };

describe("artSvg", () => {
  it("is deterministic for the same handle and index", () => {
    expect(artSvg(spec, 0)).toBe(artSvg(spec, 0));
  });

  it("differs across image index and handle", () => {
    expect(artSvg(spec, 1)).not.toBe(artSvg(spec, 0));
    expect(artSvg({ ...spec, handle: "other" }, 0)).not.toBe(artSvg(spec, 0));
  });

  it("is a 4:5 portrait document", () => {
    expect(WIDTH / HEIGHT).toBeCloseTo(4 / 5);
    expect(artSvg(spec, 0)).toContain(`viewBox="0 0 ${WIDTH} ${HEIGHT}"`);
  });

  it("renders every motif without throwing", () => {
    for (const motif of MOTIFS) {
      for (const index of [0, 1, 2]) {
        expect(artSvg({ ...spec, motif }, index)).toContain("</svg>");
      }
    }
  });

  it("rejects an unknown motif", () => {
    expect(() => artSvg({ ...spec, motif: "nope" }, 0)).toThrow(/unknown motif/);
  });
});

describe("catalogue.json motifs", () => {
  it("only uses motifs the generator knows", () => {
    const { catalogue } = readCatalogue();
    for (const p of catalogue.products) expect(MOTIFS).toContain(p.images.motif);
  });
});

describe("altText", () => {
  it("names the product and describes the image", () => {
    expect(altText(spec, 0)).toBe("Witness Tee: the Omen serpent mark, small, on a plain ground");
    expect(altText(spec, 2)).toMatch(/, view 3$/);
  });
});
