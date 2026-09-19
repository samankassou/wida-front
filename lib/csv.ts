export function csvValue(value: unknown): string {
  const text = String(value ?? "");
  // Keep numeric credit amounts numeric while shielding untrusted text formulas.
  const safeText = typeof value !== "number" && /^\s*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
