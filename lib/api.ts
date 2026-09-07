import type { DocumentRecord, FieldErrors, Invoice, ProcessingRun, WorkspaceItem } from "./types";

export class ApiError extends Error {
  status: number;
  errors: FieldErrors;
  constructor(message: string, status: number, errors: FieldErrors = {}) { super(message); this.status = status; this.errors = errors; }
}

export function normalizeFieldErrors(input: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return errors;
  for (const [key, value] of Object.entries(input)) {
    const fieldKey = key.replace(/\[(\d+)\]/g, ".$1").replace(/^\$\.?/, "").split(".").map((part) => part ? part[0].toLowerCase() + part.slice(1) : part).join(".");
    errors[fieldKey] = Array.isArray(value) ? String(value[0] ?? "Invalid value.") : String(value);
  }
  return errors;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/wida/${path}`, { ...init, cache: "no-store" }); }
  catch { throw new ApiError("Connection interrupted. Your draft is still here. Check your connection and try again.", 0); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const errors = normalizeFieldErrors(body?.errors);
    throw new ApiError(typeof body?.detail === "string" ? body.detail : typeof body?.title === "string" ? body.title : "The request could not be completed. Please try again.", response.status, errors);
  }
  return body as T;
}

export const fetchWorkspace = () => request<WorkspaceItem[]>("documents/workspace?limit=500");
export const fetchInvoices = () => request<Invoice[]>("invoices");
export const fetchRuns = (id: string) => request<ProcessingRun[]>(`processing/documents/${encodeURIComponent(id)}`);
export const analyzeDocument = (id: string) => request<ProcessingRun>(`processing/documents/${encodeURIComponent(id)}/invoice`, { method: "POST" });
export const uploadDocument = (file: File) => { const body = new FormData(); body.set("file", file); return request<DocumentRecord>("documents", { method: "POST", body }); };
export const saveInvoice = (body: Omit<Invoice, "id" | "createdAt" | "updatedAt">, id?: string) => request<Invoice>(id ? `invoices/${encodeURIComponent(id)}` : "invoices", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
