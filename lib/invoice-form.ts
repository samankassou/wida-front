import type { ExtractedField, FieldErrors, InvoiceDraft, InvoiceLineDraft, ReviewDraft, WorkspaceItem } from "./types";

export type HeaderField = Exclude<keyof InvoiceDraft, "lines">;

export const extractionFields = {
  supplierName: "VendorName",
  invoiceNumber: "InvoiceId",
  invoiceDate: "InvoiceDate",
  dueDate: "DueDate",
  subtotalAmount: "SubTotal",
  taxAmount: "TotalTax",
  discountAmount: "TotalDiscount",
  totalAmount: "InvoiceTotal",
} as const;

export const lineExtractionFields = {
  description: "Description", quantity: "Quantity", unitOfMeasure: "Unit", unitPrice: "UnitPrice",
  taxRate: "TaxRate", taxAmount: "Tax", lineAmount: "Amount",
} as const;

type LineField = keyof typeof lineExtractionFields;

export function getExtractedLineField(item: WorkspaceItem, line: InvoiceLineDraft, field: LineField): ExtractedField | undefined {
  if (item.invoice || !line.id.startsWith("extracted-line-")) return undefined;
  const index = line.id.slice("extracted-line-".length);
  return item.latestRun?.extractedFields.find((entry) => entry.fieldName === `Items[${index}].${lineExtractionFields[field]}`);
}

export function lineCheckKey(line: InvoiceLineDraft, field: LineField): string {
  return `${line.id}.${field}`;
}

function extractedLines(item: WorkspaceItem): InvoiceLineDraft[] {
  const lines = new Map<number, InvoiceLineDraft>();
  for (const field of item.latestRun?.extractedFields ?? []) {
    const match = /^Items\[(\d+)\]\.(\w+)$/.exec(field.fieldName);
    if (!match) continue;
    const key = (Object.keys(lineExtractionFields) as LineField[]).find((key) => lineExtractionFields[key] === match[2]);
    if (!key) continue;
    const index = Number(match[1]);
    const line = lines.get(index) ?? emptyLine(`extracted-line-${index}`);
    const value = extractedValue(field);
    // Azure returns tax rates as strings, e.g. "18 %" or "19,25 %".
    line[key] = key === "taxRate" && /^-?\d+(?:[.,]\d+)?\s*%$/.test(value.trim())
      ? value.trim().replace(/\s*%$/, "").replace(",", ".") : value;
    lines.set(index, line);
  }
  return [...lines].sort(([first], [second]) => first - second).map(([, line]) => line);
}

export const fieldLabels: Record<HeaderField, string> = {
  supplierName: "Supplier name", supplierAddress: "Supplier address", supplierTaxId: "Supplier tax ID",
  invoiceNumber: "Invoice number", invoiceDate: "Invoice date", dueDate: "Due date",
  purchaseOrderNumber: "Purchase order", currency: "Currency", subtotalAmount: "Subtotal",
  shippingAmount: "Shipping amount", discountAmount: "Discount amount",
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
    purchaseOrderNumber: "", currency: "", shippingAmount: "", discountAmount: "", subtotalAmount: "", taxAmount: "", totalAmount: "", lines: [],
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
    return { values, checkedFields: Object.keys(extractionFields), extractionRunId: item.latestRun?.status === "Completed" ? item.latestRun.id : null };
  }
  for (const key of Object.keys(extractionFields) as (keyof typeof extractionFields)[]) {
    values[key] = extractedValue(getExtractedField(item, key));
    if ((key === "invoiceDate" || key === "dueDate") && /^\d{4}-\d{2}-\d{2}/.test(values[key])) values[key] = values[key].slice(0, 10);
  }
  values.currency = getExtractedCurrency(item);
  values.lines = extractedLines(item);
  return { values, checkedFields: [], extractionRunId: item.latestRun?.status === "Completed" ? item.latestRun.id : null };
}

// Only user edits are cached. Untouched forms always follow the latest extraction.
export function resolveDraft(item: WorkspaceItem, edited?: ReviewDraft): ReviewDraft {
  if (!edited) return createDraft(item);
  const extractionRunId = item.latestRun?.status === "Completed" ? item.latestRun.id : null;
  return edited.extractionRunId === extractionRunId
    ? edited
    : { ...edited, checkedFields: [], extractionRunId };
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

// Preserve the source amount; use the net base only when supplied tax explains the difference.
export function taxInclusiveLineNet(line: InvoiceLineDraft): number | null {
  const quantity = numericValue(line.quantity);
  const price = numericValue(line.unitPrice);
  const amount = numericValue(line.lineAmount);
  if (quantity === null || price === null || amount === null) return null;
  const net = quantity * price;
  if (!Number.isFinite(net) || amountMatches(net, amount)) return null;
  const tax = numericValue(line.taxAmount);
  const rate = numericValue(line.taxRate);
  if ((line.taxAmount.trim() && tax === null) || (line.taxRate.trim() && rate === null)) return null;
  if (tax === null && rate === null) return null;
  if (tax !== null && !amountMatches(net + tax, amount)) return null;
  if (rate !== null && !amountMatches(net + net * rate / 100, amount)) return null;
  return net;
}

export function validateDraft(draft: ReviewDraft, item: WorkspaceItem, t: (message: string, values?: Record<string, string | number>) => string = (message, values) => message.replace(/\{(\w+)\}/g, (match, key: string) => String(values?.[key] ?? match))): FieldErrors {
  const errors: FieldErrors = {};
  const values = draft.values;
  for (const field of ["supplierName", "invoiceNumber", "invoiceDate", "totalAmount"] as const) {
    if (!values[field].trim()) errors[field] = t("{field} is required.", { field: t(fieldLabels[field]) });
  }
  for (const field of ["invoiceDate", "dueDate"] as const) {
    if (values[field].trim() && !isValidDate(values[field])) errors[field] = t("Enter a valid calendar date.");
  }
  if (isValidDate(values.invoiceDate) && isValidDate(values.dueDate) && values.dueDate < values.invoiceDate) {
    errors.dueDate = t("Due date cannot be before the invoice date.");
  }
  for (const field of ["subtotalAmount", "taxAmount", "shippingAmount", "discountAmount", "totalAmount"] as const) {
    if (values[field].trim() && numericValue(values[field]) === null) errors[field] = t("Enter an amount using a decimal point, for example 1200.00.");
  }
  if (values.currency.trim() && !/^[a-zA-Z]{3}$/.test(values.currency.trim())) errors.currency = t("Use a three-letter currency code, such as EUR or XAF.");
  const subtotal = numericValue(values.subtotalAmount);
  const tax = numericValue(values.taxAmount);
  const total = numericValue(values.totalAmount);
  const shipping = numericValue(values.shippingAmount) ?? 0;
  const discount = numericValue(values.discountAmount) ?? 0;
  const expectedTotal = (subtotal ?? 0) + (tax ?? 0) + shipping - discount;
  if (subtotal !== null && tax !== null && total !== null && !errors.shippingAmount && !errors.discountAmount && !amountMatches(expectedTotal, total)) {
    errors.totalAmount = t("Subtotal + tax + shipping − discount equals {amount}. Check shipping and discounts against the document.", { amount: expectedTotal.toFixed(2) });
  }
  values.lines.forEach((line, index) => {
    for (const field of Object.keys(lineExtractionFields) as LineField[]) {
      if (fieldNeedsCheck(getExtractedLineField(item, line, field)) && !draft.checkedFields.includes(lineCheckKey(line, field))) {
        errors[`lines.${index}.${field}`] = t("Check this value against the original document and mark it checked.");
      }
    }
    for (const field of ["quantity", "unitPrice", "taxRate", "taxAmount", "lineAmount"] as const) {
      if (line[field].trim() && numericValue(line[field]) === null) errors[`lines.${index}.${field}`] = t("Enter a valid number using a decimal point.");
    }
    const quantity = numericValue(line.quantity);
    const unitPrice = numericValue(line.unitPrice);
    const amount = numericValue(line.lineAmount);
    if (quantity !== null && unitPrice !== null && amount !== null && !amountMatches(quantity * unitPrice, amount) && taxInclusiveLineNet(line) === null) {
      errors[`lines.${index}.lineAmount`] = t("Quantity × unit price equals {amount}. The line amount must match this or include the specified tax.", { amount: (quantity * unitPrice).toFixed(2) });
    }
  });
  const lineAmounts = values.lines.map((line) => taxInclusiveLineNet(line) ?? numericValue(line.lineAmount));
  if (subtotal !== null && lineAmounts.length > 0 && lineAmounts.every((amount) => amount !== null)) {
    const lineTotal = lineAmounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
    if (!amountMatches(lineTotal, subtotal)) errors.subtotalAmount = t("Line items total {amount}. Check the subtotal.", { amount: lineTotal.toFixed(2) });
  }
  for (const field of Object.keys(extractionFields) as (keyof typeof extractionFields)[]) {
    if (fieldNeedsCheck(getExtractedField(item, field)) && !draft.checkedFields.includes(field) && !errors[field]) {
      errors[field] = t("Check this value against the original document and mark it checked.");
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
    shippingAmount: numericValue(values.shippingAmount), discountAmount: numericValue(values.discountAmount),
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
