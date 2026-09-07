import type { ExtractedField, FieldErrors, InvoiceDraft, InvoiceLineDraft, ReviewDraft, WorkspaceItem } from "./types";

export type HeaderField = Exclude<keyof InvoiceDraft, "lines">;

export const extractionFields = {
  supplierName: "VendorName",
  invoiceNumber: "InvoiceId",
  invoiceDate: "InvoiceDate",
  dueDate: "DueDate",
  subtotalAmount: "SubTotal",
  taxAmount: "TotalTax",
  totalAmount: "InvoiceTotal",
} as const;

export const fieldLabels: Record<HeaderField, string> = {
  supplierName: "Supplier name", supplierAddress: "Supplier address", supplierTaxId: "Supplier tax ID",
  invoiceNumber: "Invoice number", invoiceDate: "Invoice date", dueDate: "Due date",
  purchaseOrderNumber: "Purchase order", currency: "Currency", subtotalAmount: "Subtotal",
  taxAmount: "Tax amount", totalAmount: "Total amount",
};

export function getExtractedField(item: WorkspaceItem, field: HeaderField): ExtractedField | undefined {
  const apiField = extractionFields[field as keyof typeof extractionFields];
  return apiField ? item.latestRun?.extractedFields.find((entry) => entry.fieldName === apiField) : undefined;
}

export function fieldNeedsCheck(field: ExtractedField | undefined): boolean {
  return Boolean(field && (field.requiresReview || field.confidence === null || field.confidence < 0.8));
}

export function getExtractedCurrency(item: WorkspaceItem): string {
  const field = getExtractedField(item, "totalAmount");
  const normalized = field?.normalizedValue;
  if (!field || fieldNeedsCheck(field) || !normalized || typeof normalized !== "object" || !("currencyCode" in normalized)) return "";
  const code = normalized.currencyCode;
  return typeof code === "string" && /^[a-zA-Z]{3}$/.test(code.trim()) ? code.trim().toUpperCase() : "";
}

function extractedValue(field: ExtractedField | undefined): string {
  if (!field) return "";
  const normalized = field.normalizedValue;
  if (typeof normalized === "string" || typeof normalized === "number") return String(normalized);
  if (normalized && typeof normalized === "object" && "amount" in normalized) {
    const amount = (normalized as { amount: unknown }).amount;
    if (typeof amount === "number" || typeof amount === "string") return String(amount);
  }
  return field.rawValue ?? "";
}

export function createDraft(item: WorkspaceItem): ReviewDraft {
  const values: InvoiceDraft = {
    supplierName: "", supplierAddress: "", supplierTaxId: "", invoiceNumber: "", invoiceDate: "", dueDate: "",
    purchaseOrderNumber: "", currency: "", subtotalAmount: "", taxAmount: "", totalAmount: "", lines: [],
  };
  if (item.invoice) {
    for (const key of Object.keys(values) as (keyof InvoiceDraft)[]) {
      if (key !== "lines") values[key] = item.invoice[key] == null ? "" : String(item.invoice[key]);
    }
    values.lines = item.invoice.lines.map((line, index) => ({
      id: line.id ?? `saved-line-${index}`, description: line.description ?? "", quantity: line.quantity == null ? "" : String(line.quantity),
      unitOfMeasure: line.unitOfMeasure ?? "", unitPrice: line.unitPrice == null ? "" : String(line.unitPrice),
      taxRate: line.taxRate == null ? "" : String(line.taxRate), taxAmount: line.taxAmount == null ? "" : String(line.taxAmount),
      lineAmount: line.lineAmount == null ? "" : String(line.lineAmount),
    }));
    return { values, checkedFields: Object.keys(extractionFields) };
  }
  for (const key of Object.keys(extractionFields) as (keyof typeof extractionFields)[]) {
    values[key] = extractedValue(getExtractedField(item, key));
    if ((key === "invoiceDate" || key === "dueDate") && /^\d{4}-\d{2}-\d{2}/.test(values[key])) values[key] = values[key].slice(0, 10);
  }
  values.currency = getExtractedCurrency(item);
  return { values, checkedFields: [] };
}

const numericPattern = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
export function numericValue(value: string): number | null {
  const clean = value.trim();
  if (!clean || !numericPattern.test(clean)) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function amountMatches(first: number, second: number): boolean {
  return Math.abs(first - second) <= 0.01 + 1e-8;
}

export function validateDraft(draft: ReviewDraft, item: WorkspaceItem): FieldErrors {
  const errors: FieldErrors = {};
  const values = draft.values;
  for (const field of ["supplierName", "invoiceNumber", "invoiceDate", "totalAmount"] as const) {
    if (!values[field].trim()) errors[field] = `${fieldLabels[field]} is required.`;
  }
  for (const field of ["invoiceDate", "dueDate"] as const) {
    if (values[field].trim() && !isValidDate(values[field])) errors[field] = "Enter a valid calendar date.";
  }
  if (isValidDate(values.invoiceDate) && isValidDate(values.dueDate) && values.dueDate < values.invoiceDate) {
    errors.dueDate = "Due date cannot be before the invoice date.";
  }
  for (const field of ["subtotalAmount", "taxAmount", "totalAmount"] as const) {
    if (values[field].trim() && numericValue(values[field]) === null) errors[field] = "Enter an amount using a decimal point, for example 1200.00.";
  }
  if (values.currency.trim() && !/^[a-zA-Z]{3}$/.test(values.currency.trim())) errors.currency = "Use a three-letter currency code, such as EUR or XAF.";
  const subtotal = numericValue(values.subtotalAmount);
  const tax = numericValue(values.taxAmount);
  const total = numericValue(values.totalAmount);
  if (subtotal !== null && tax !== null && total !== null && !amountMatches(subtotal + tax, total)) {
    errors.totalAmount = `Subtotal + tax equals ${(subtotal + tax).toFixed(2)}. Check the total against the document.`;
  }
  values.lines.forEach((line, index) => {
    for (const field of ["quantity", "unitPrice", "taxRate", "taxAmount", "lineAmount"] as const) {
      if (line[field].trim() && numericValue(line[field]) === null) errors[`lines.${index}.${field}`] = "Enter a valid number using a decimal point.";
    }
    const quantity = numericValue(line.quantity);
    const unitPrice = numericValue(line.unitPrice);
    const amount = numericValue(line.lineAmount);
    if (quantity !== null && unitPrice !== null && amount !== null && !amountMatches(quantity * unitPrice, amount)) {
      errors[`lines.${index}.lineAmount`] = `Quantity × unit price equals ${(quantity * unitPrice).toFixed(2)}.`;
    }
  });
  const lineAmounts = values.lines.map((line) => numericValue(line.lineAmount));
  if (subtotal !== null && lineAmounts.length > 0 && lineAmounts.every((amount) => amount !== null)) {
    const lineTotal = lineAmounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
    if (!amountMatches(lineTotal, subtotal)) errors.subtotalAmount = `Line items total ${lineTotal.toFixed(2)}. Check the subtotal.`;
  }
  for (const field of Object.keys(extractionFields) as (keyof typeof extractionFields)[]) {
    if (fieldNeedsCheck(getExtractedField(item, field)) && !draft.checkedFields.includes(field) && !errors[field]) {
      errors[field] = "Check this value against the original document and mark it checked.";
    }
  }
  return errors;
}

const optionalText = (value: string): string | null => value.trim() || null;

export function toInvoicePayload(values: InvoiceDraft, documentId: string) {
  return {
    documentId,
    supplierName: optionalText(values.supplierName), supplierAddress: optionalText(values.supplierAddress), supplierTaxId: optionalText(values.supplierTaxId),
    invoiceNumber: optionalText(values.invoiceNumber), invoiceDate: optionalText(values.invoiceDate), dueDate: optionalText(values.dueDate),
    purchaseOrderNumber: optionalText(values.purchaseOrderNumber), currency: optionalText(values.currency)?.toUpperCase() ?? null,
    subtotalAmount: numericValue(values.subtotalAmount), taxAmount: numericValue(values.taxAmount), totalAmount: numericValue(values.totalAmount),
    lines: values.lines.map((line, index) => ({
      lineNumber: index + 1, description: optionalText(line.description), quantity: numericValue(line.quantity),
      unitOfMeasure: optionalText(line.unitOfMeasure), unitPrice: numericValue(line.unitPrice), taxRate: numericValue(line.taxRate),
      taxAmount: numericValue(line.taxAmount), lineAmount: numericValue(line.lineAmount),
    })),
  };
}

export function emptyLine(id: string): InvoiceLineDraft {
  return { id, description: "", quantity: "", unitOfMeasure: "", unitPrice: "", taxRate: "", taxAmount: "", lineAmount: "" };
}
