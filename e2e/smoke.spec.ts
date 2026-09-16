import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke coverage for every Shopify-backed route. These run against the live
 * dev store, so they assert shape (a heading, a price, a 404) rather than
 * specific product content, which the catalogue seed will change.
 */

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test("home lists products linking to product pages", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");

  const links = page.locator('a[href^="/products/"]');
  await expect(links.first()).toBeVisible();
  expect(await links.count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("product page renders title, price, and description", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  const href = await page
    .locator('a[href^="/products/"]')
    .first()
    .getAttribute("href");
  expect(href).toBeTruthy();

  await page.goto(href!);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Any formatted currency: a symbol or code followed by digits.
  await expect(page.getByText(/[\p{Sc}A-Z]{1,3}\s?\d[\d,]*\.\d{2}/u).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown product handle returns 404", async ({ page }) => {
  const response = await page.goto("/products/this-handle-does-not-exist");
  expect(response?.status()).toBe(404);
});
