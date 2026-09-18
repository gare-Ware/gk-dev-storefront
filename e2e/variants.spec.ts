import { expect, test } from "@playwright/test";

/**
 * Variant resolution against the live store, using the seeded catalogue
 * (scripts/catalogue.json). Each test skips (not fails) if its product is
 * missing, so an unseeded store does not break CI.
 */
const MULTI = "/products/witness-tee"; // Size: XS–XXL × Color: Black, Bone; Bone XS and XXL sold out
const SINGLE = "/products/zener-deck"; // Title: Default Title
const SOLD_OUT = "/products/monolith"; // single variant, no stock

test("a selection in the URL survives refresh and is marked selected", async ({ page }) => {
  // A full, in-stock selection. A partial one (`?Color=Bone` alone) matches the
  // first Bone variant, which is the sold-out XS, and Shopify falls back to the
  // first available variant instead: correct, but not what this test is about.
  const res = await page.goto(`${MULTI}?Size=M&Color=Bone`);
  test.skip(res?.status() === 404, "seeded product not found");

  const bone = page.locator('li[data-option="Color"][data-value="Bone"]');
  const medium = page.locator('li[data-option="Size"][data-value="M"]');
  await expect(bone).toContainText("selected");
  await expect(medium).toContainText("selected");
  await page.reload();
  await expect(bone).toContainText("selected");
  expect(page.url()).toContain("Color=Bone");
});

test("a partial selection whose first match is sold out falls back to an available variant", async ({ page }) => {
  const res = await page.goto(`${MULTI}?Color=Bone`);
  test.skip(res?.status() === 404, "seeded product not found");

  // XS / Bone is sold out, so the server resolves to the first available variant
  // (XS / Black) and Bone reads as unavailable for the resolved size.
  await expect(page.locator('li[data-option="Color"][data-value="Black"]')).toContainText("selected");
  await expect(page.locator('li[data-option="Color"][data-value="Bone"]')).toHaveAttribute("data-state", "unavailable");
});

test("an unknown value degrades to a sensible variant without error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  const res = await page.goto(`${MULTI}?Color=Purple`);
  test.skip(res?.status() === 404, "seeded product not found");

  expect(res?.status()).toBe(200);
  await expect(page.locator('li[data-option="Color"]').first()).toBeVisible();
  // Exactly one value is marked selected: the server-resolved fallback.
  await expect(page.locator('li[data-option="Color"]', { hasText: "selected" })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("every option value carries one of the three states", async ({ page }) => {
  const res = await page.goto(MULTI);
  test.skip(res?.status() === 404, "seeded product not found");

  const states = await page.locator("li[data-state]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-state"))
  );
  expect(states.length).toBeGreaterThan(0);
  for (const s of states) expect(["available", "unavailable", "nonexistent"]).toContain(s);
});

test("a sold-out combination is unavailable, not hidden", async ({ page }) => {
  const res = await page.goto(`${MULTI}?Size=XS&Color=Black`);
  test.skip(res?.status() === 404, "seeded product not found");

  // With XS selected, Bone is sold out: the value stays, marked unavailable.
  await expect(page.locator('li[data-option="Color"][data-value="Bone"]')).toHaveAttribute(
    "data-state",
    "unavailable"
  );
  await expect(page.locator('li[data-option="Color"][data-value="Black"]')).toHaveAttribute(
    "data-state",
    "available"
  );
});

test("a single-variant product renders no option selector", async ({ page }) => {
  const res = await page.goto(SINGLE);
  test.skip(res?.status() === 404, "seeded product not found");

  await expect(page.locator("li[data-option]")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a sold-out single-variant product says so", async ({ page }) => {
  const res = await page.goto(SOLD_OUT);
  test.skip(res?.status() === 404, "seeded product not found");

  await expect(page.getByText(/sold out/i).first()).toBeVisible();
});
