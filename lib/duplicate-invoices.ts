import type { DuplicateInvoice, Invoice, InvoiceDraft, WorkspaceItem } from "./types";

export function normalizeInvoiceIdentity(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function findDuplicateInvoices(items: WorkspaceItem[], values: Pick<InvoiceDraft, "supplierName" | "invoiceNumber">, documentId: string): DuplicateInvoice[] {
  const supplier = normalizeInvoiceIdentity(values.supplierName);
  const number = normalizeInvoiceIdentity(values.invoiceNumber);
  if (!supplier || !number) return [];
  return items.map(item => item.invoice).filter((invoice): invoice is Invoice => Boolean(invoice && invoice.documentId !== documentId
    && normalizeInvoiceIdentity(invoice.supplierName) === supplier
    && normalizeInvoiceIdentity(invoice.invoiceNumber) === number)).slice(0, 10)
    .map(({ id, documentId, supplierName, invoiceNumber, invoiceDate, currency, totalAmount }) => ({ id, documentId, supplierName, invoiceNumber, invoiceDate, currency, totalAmount }));
}

export async function fileContentHash(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
