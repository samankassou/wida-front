import type { DocumentStage, WorkspaceItem } from "./types";
import { getExtractedCurrency } from "./invoice-form";

export function stageOf(item: WorkspaceItem): DocumentStage {
  if (item.invoice) return "saved";
  if (item.latestRun?.status === "Running" || item.latestRun?.status === "Pending") return "processing";
  if (item.latestRun?.status === "Failed") return "failed";
  if (item.latestRun?.status === "Completed") return "review";
  return "uploaded";
}
export const stageLabels: Record<DocumentStage, string> = { review: "Needs review", saved: "Invoice saved", processing: "Processing", failed: "Extraction failed", uploaded: "Uploaded" };
export function fieldValue(item: WorkspaceItem, fieldName: string): string {
  const field = item.latestRun?.extractedFields.find(field => field.fieldName === fieldName);
  if (!field) return "";
  const value = field.normalizedValue;
  if (value && typeof value === "object" && "amount" in value) return String(value.amount);
  return typeof value === "string" || typeof value === "number" ? String(value) : field.rawValue ?? "";
}
export const supplierOf = (item: WorkspaceItem) => item.invoice?.supplierName || fieldValue(item, "VendorName") || item.sample?.supplierName || item.document.originalFileName.replace(/\.[^.]+$/, "");
export const numberOf = (item: WorkspaceItem) => item.invoice?.invoiceNumber || fieldValue(item, "InvoiceId");
export function currencyOf(item: WorkspaceItem): string {
  if (item.invoice?.currency) return item.invoice.currency;
  return getExtractedCurrency(item);
}
export function amountOf(item: WorkspaceItem): number | null {
  if (item.invoice?.totalAmount != null) return item.invoice.totalAmount;
  const value = fieldValue(item, "InvoiceTotal");
  return value && Number.isFinite(Number(value)) ? Number(value) : null;
}
export { money } from "./money";
export const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
export const sizeLabel = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;
