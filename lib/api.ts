import type { AuthSession, DocumentRecord, FieldErrors, Invoice, ProcessingRun, WorkspaceItem } from "./types";

export interface ApiSession {
  csrfToken: string;
  onUnauthenticated: () => void;
  signal?: AbortSignal;
}

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

async function request<T>(path: string, init?: RequestInit, session?: ApiSession): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase()) && session) headers.set("X-CSRF-TOKEN", session.csrfToken);
  let response: Response;
  try { response = await fetch(`/api/wida/${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store", signal: session?.signal ?? init?.signal }); }
  catch (cause) {
    if (session?.signal?.aborted || init?.signal?.aborted) throw cause;
    throw new ApiError("Connection interrupted. Your draft is still here. Check your connection and try again.", 0);
  }
  if (response.status === 401) {
    session?.onUnauthenticated();
    throw new ApiError("Your session has expired. Sign in again with the same account to recover your draft.", 401);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const errors = normalizeFieldErrors(body?.errors);
    throw new ApiError(typeof body?.detail === "string" ? body.detail : typeof body?.title === "string" ? body.title : "The request could not be completed. Please try again.", response.status, errors);
  }
  return body as T;
}

export const fetchSession = (signal?: AbortSignal) => request<AuthSession>("auth/session", { signal });
export const logout = (session: ApiSession) => request<void>("auth/logout", { method: "POST" }, session);

// Each mounted workspace owns its session. Nothing sensitive is shared through
// mutable module state during server rendering or between signed-in accounts.
export function createApiClient(session?: ApiSession) {
  return {
    fetchWorkspace: () => request<WorkspaceItem[]>("documents/workspace?limit=500", undefined, session),
    fetchRuns: (id: string) => request<ProcessingRun[]>(`processing/documents/${encodeURIComponent(id)}`, undefined, session),
    analyzeDocument: (id: string) => request<ProcessingRun>(`processing/documents/${encodeURIComponent(id)}/invoice`, { method: "POST" }, session),
    uploadDocument: (file: File) => {
      const body = new FormData(); body.set("file", file);
      return request<DocumentRecord>("documents", { method: "POST", body }, session);
    },
    saveInvoice: (body: Omit<Invoice, "id" | "createdAt" | "updatedAt">, id?: string) => request<Invoice>(id ? `invoices/${encodeURIComponent(id)}` : "invoices", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, session),
  };
}
