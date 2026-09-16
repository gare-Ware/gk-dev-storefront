import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats a decimal-string amount in its currency", () => {
    expect(formatMoney({ amount: "29.95", currencyCode: "USD" })).toBe("$29.95");
  });

  it("keeps trailing zeros Shopify omits", () => {
    expect(formatMoney({ amount: "1200.0", currencyCode: "USD" })).toBe(
      "$1,200.00"
    );
  });

  it("respects the currency code, not the locale, for the symbol", () => {
    expect(formatMoney({ amount: "10", currencyCode: "EUR" })).toBe("€10.00");
  });
});
