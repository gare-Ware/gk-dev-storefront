/**
 * Storefront API money is `{ amount: "29.95", currencyCode: "USD" }` — a decimal
 * string, never a number. Format it once here so every surface agrees.
 */
export type Money = { amount: string; currencyCode: string };

export function formatMoney(money: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currencyCode,
  }).format(Number(money.amount));
}
