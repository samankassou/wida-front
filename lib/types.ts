export type WorkspaceMode = "demo" | "live";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthSession {
  authenticated: boolean;
  googleConfigured: boolean;
  user: SessionUser | null;
  csrfToken: string;
}

export interface DocumentRecord {
  id: string;
  originalFileName: string;
  contentType: string;
  documentType: string;
  status: string;
  uploadedAt: string;
}

export interface ExtractedField {
  id: string;
  fieldName: string;
  rawValue: string | null;
  normalizedValue: unknown;
  confidence: number | null;
  source: "Ocr" | "DocumentIntelligence" | "Llm" | "Rule" | "Human";
  pageNumber: number | null;
  boundingBox: unknown;
  requiresReview: boolean;
}

export interface ProcessingRun {
  id: string;
  documentId: string;
  status: "Pending" | "Running" | "Completed" | "Failed";
  processor: string;
  processorVersion: string | null;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  extractedFields: ExtractedField[];
}

export interface InvoiceLine {
  id?: string;
  lineNumber: number | null;
  description: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  unitPrice: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  lineAmount: number | null;
}

export interface Invoice {
  id: string;
  documentId: string;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierTaxId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  purchaseOrderNumber: string | null;
  currency: string | null;
  shippingAmount: number | null;
  discountAmount: number | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  lines: InvoiceLine[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineDraft {
  id: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  lineAmount: string;
}

export interface InvoiceDraft {
  supplierName: string;
  supplierAddress: string;
  supplierTaxId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  purchaseOrderNumber: string;
  currency: string;
  shippingAmount: string;
  discountAmount: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  lines: InvoiceLineDraft[];
}

export interface ReviewDraft {
  /** Completed extraction whose values were reviewed; null before an extraction completes. */
  extractionRunId: string | null;
  values: InvoiceDraft;
  checkedFields: string[];
}

export interface WorkspaceItem {
  document: DocumentRecord;
  invoice: Invoice | null;
  latestRun: ProcessingRun | null;
  /** Fictional original, only present on the built-in demonstration documents. */
  sample?: InvoiceDraft;
}

export type DocumentStage = "review" | "processing" | "saved" | "failed" | "uploaded";
export type FieldErrors = Record<string, string>;
