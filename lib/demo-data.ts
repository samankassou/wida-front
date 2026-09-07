import type { Invoice, InvoiceDraft, ProcessingRun, WorkspaceItem } from "./types";

const id = (value: number) => `d8c0a100-0000-4000-8000-${String(value).padStart(12, "0")}`;
const specs = [
  { name: "Atelier North", number: "INV-2026-0137", amount: 1200, tax: 240, currency: "EUR", description: "Brand strategy & visual identity", date: "2026-09-01", due: "2026-09-30", stage: "review" },
  { name: "Studio Fern", number: "FERN-2026-082", amount: 680, tax: 136, currency: "EUR", description: "Editorial photography · September", date: "2026-09-02", due: "2026-09-25", stage: "review" },
  { name: "Northstar Logistics", number: "NS-00912", amount: 2450, tax: 0, currency: "USD", description: "Regional shipping & handling", date: "2026-09-03", due: "2026-10-03", stage: "review" },
  { name: "Maison Papier", number: "MP-26104", amount: 125000, tax: 24062.5, currency: "XAF", description: "Office stationery & paper supplies", date: "2026-09-04", due: "2026-09-20", stage: "review" },
  { name: "Vale Printing", number: "VAL-2026-0081", amount: 200, tax: 40, currency: "EUR", description: "Business cards · 500 copies", date: "2026-08-31", due: "2026-09-30", stage: "saved" },
  { name: "Marlow Studio", number: "MAR-065", amount: 1800, tax: 360, currency: "EUR", description: "Website design · milestone two", date: "2026-08-28", due: "2026-09-28", stage: "saved" },
  { name: "Cedar Office", number: "CED-0049", amount: 340, tax: 68, currency: "EUR", description: "Workspace accessories", date: "2026-09-05", due: "2026-10-05", stage: "uploaded" },
  { name: "Orchard Supply", number: "ORC-0028", amount: 460, tax: 92, currency: "EUR", description: "Packaging materials", date: "2026-09-01", due: "2026-09-30", stage: "failed" },
] as const;

export function getDemoRun(item: WorkspaceItem): ProcessingRun {
  const sample = item.sample!;
  const keys = { VendorName: "supplierName", InvoiceId: "invoiceNumber", InvoiceDate: "invoiceDate", DueDate: "dueDate", SubTotal: "subtotalAmount", TotalTax: "taxAmount", InvoiceTotal: "totalAmount" } as const;
  return {
    id: `${item.document.id.slice(0, 8)}-0100${item.document.id.slice(13)}`,
    documentId: item.document.id, status: "Completed", processor: "Sample invoice extraction", processorVersion: "demo",
    startedAt: item.document.uploadedAt, completedAt: "2026-09-07T09:42:07Z", errorCode: null, errorMessage: null,
    extractedFields: Object.entries(keys).map(([fieldName, key], index) => {
      const uncertain = fieldName === "InvoiceId" && item.document.id === id(1);
      const value = uncertain ? "INV-2026-0187" : sample[key];
      return { id: `${item.document.id}-${index}`, fieldName, rawValue: value, normalizedValue: key.endsWith("Amount") ? { amount: Number(value), currencyCode: sample.currency } : value, confidence: uncertain ? 0.72 : 0.97 + (index % 3) * 0.01, source: "DocumentIntelligence", pageNumber: 1, boundingBox: null, requiresReview: uncertain };
    }),
  };
}

export function getDemoItems(): WorkspaceItem[] {
  return specs.map((spec, index) => {
    const source: InvoiceDraft = {
      supplierName: spec.name, supplierAddress: "24 Willow Street\nDesign district", supplierTaxId: "", invoiceNumber: spec.number,
      invoiceDate: spec.date, dueDate: spec.due, purchaseOrderNumber: `PO-2026-${104 + index}`, currency: spec.currency,
      subtotalAmount: String(spec.amount), taxAmount: String(spec.tax), totalAmount: String(spec.amount + spec.tax),
      lines: [{ id: `line-${index}`, description: spec.description, quantity: "1", unitOfMeasure: "service", unitPrice: String(spec.amount), taxRate: String(spec.tax / spec.amount * 100), taxAmount: String(spec.tax), lineAmount: String(spec.amount) }],
    };
    const item: WorkspaceItem = {
      document: { id: id(index + 1), originalFileName: `${spec.name.toLowerCase().replaceAll(" ", "-")}-${spec.number.split("-").at(-1)}.pdf`, contentType: "application/pdf", documentType: "Invoice", status: spec.stage === "saved" ? "Saved" : spec.stage === "uploaded" ? "Uploaded" : spec.stage === "failed" ? "Failed" : "ReviewRequired", uploadedAt: `2026-09-07T${String(9 - Math.floor(index / 3)).padStart(2, "0")}:${String(42 - index * 3).padStart(2, "0")}:00Z` },
      invoice: null, latestRun: null, sample: source,
    };
    if (spec.stage !== "uploaded") item.latestRun = getDemoRun(item);
    if (spec.stage === "failed") item.latestRun = { ...item.latestRun!, status: "Failed", extractedFields: [], errorCode: "DOCUMENT_ANALYSIS_FAILED", errorMessage: "The scanned page could not be read clearly. Try extracting again, or enter the invoice details manually." };
    if (spec.stage === "saved") item.invoice = {
      ...source, id: id(index + 101), documentId: item.document.id, subtotalAmount: spec.amount, taxAmount: spec.tax, totalAmount: spec.amount + spec.tax,
      lines: [{ id: id(index + 201), lineNumber: 1, description: spec.description, quantity: 1, unitOfMeasure: "service", unitPrice: spec.amount, taxRate: spec.tax / spec.amount * 100, taxAmount: spec.tax, lineAmount: spec.amount }], createdAt: item.document.uploadedAt, updatedAt: item.document.uploadedAt,
    } as Invoice;
    return item;
  });
}
