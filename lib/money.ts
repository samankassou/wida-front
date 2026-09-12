/** Display only: invoice values retain their original precision. */
export function money(amount: number | null, currency = "", locale = "fr-FR"): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const decimalFormatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const code = currency.trim().toUpperCase();
  if (!code) return decimalFormatter.format(amount);
  // Invalid extraction output must not break rendering or invent a currency.
  if (!/^[A-Z]{3}$/.test(code)) return decimalFormatter.format(amount);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    currencyDisplay: "code",
  }).format(amount);
}
