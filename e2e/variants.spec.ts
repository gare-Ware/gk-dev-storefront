import { expect, test } from "@playwright/test";

/**
 * Variant resolution against the live store. Tied to Shopify's test data by
 * handle; each test skips (not fails) if that product is gone, so the catalogue
 * seed does not break CI. Re-point the handles when the Omen catalogue lands.
 */
const MULTI = "/products/the-complete-snowboard"; // Color: Dawn, Powder, Electric, Sunset, Ice
const SINGLE = "/products/the-inventory-not-tracked-snowboard"; // Title: Default Title

test("a selection in the URL survives refresh and is marked selected", async ({ page }) => {
  const res = await page.goto(`${MULTI}?Color=Dawn`);
  test.skip(res?.status() === 404, "test-data product no longer exists");

  const dawn = page.locator('li[data-option="Color"][data-value="Dawn"]');
  await expect(dawn).toContainText("selected");
  await page.reload();
  await expect(dawn).toContainText("selected");
  expect(page.url()).toContain("Color=Dawn");
});

test("an unknown value degrades to a sensible variant without error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  const res = await page.goto(`${MULTI}?Color=Purple`);
  test.skip(res?.status() === 404, "test-data product no longer exists");

  expect(res?.status()).toBe(200);
  await expect(page.locator('li[data-option="Color"]').first()).toBeVisible();
  // Exactly one value is marked selected: the server-resolved fallback.
  await expect(page.locator('li[data-option="Color"]', { hasText: "selected" })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("every option value carries one of the three states", async ({ page }) => {
  const res = await page.goto(MULTI);
  test.skip(res?.status() === 404, "test-data product no longer exists");

  const states = await page.locator("li[data-state]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-state"))
  );
  expect(states.length).toBeGreaterThan(0);
  for (const s of states) expect(["available", "unavailable", "nonexistent"]).toContain(s);
});

test("a single-variant product renders no option selector", async ({ page }) => {
  const res = await page.goto(SINGLE);
  test.skip(res?.status() === 404, "test-data product no longer exists");

  await expect(page.locator("li[data-option]")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
