const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Display only: invoice values retain their original precision. */
export function money(amount: number | null, currency = ""): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const code = currency.trim().toUpperCase();
  if (!code) return decimalFormatter.format(amount);
  // Invalid extraction output must not break rendering or invent a currency.
  if (!/^[A-Z]{3}$/.test(code)) return decimalFormatter.format(amount);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: code,
    currencyDisplay: "code",
  }).format(amount);
}
