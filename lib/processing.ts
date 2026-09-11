import type { ProcessingRun, WorkspaceItem } from "./types";

export interface UploadResult { item: WorkspaceItem; analysisError?: string }

export function analysisRequestMessage(status?: number): string {
  if (status === 429) return "Your document is saved. Analysis capacity is full. Try again once an analysis finishes, or enter the details manually.";
  if (status === 503) return "Your document is saved. Analysis is temporarily unavailable. Try again later; no need to upload the file again.";
  if (status === 401) return "Your document is saved. Sign in again to check its analysis status.";
  return "Your document is saved, but we could not confirm the analysis request. Refresh its status before retrying; no need to upload it again.";
}

export function analysisLabel(run: ProcessingRun): string {
  return run.status === "Pending" ? "Waiting to start" : run.status === "Running" ? "Extracting details" : run.status === "Completed" ? "Ready to review" : "Needs attention";
}

export function analysisDescription(run: ProcessingRun): string {
  if (run.status === "Pending") return "Your document is safely queued. Processing starts automatically when a slot is available. You can leave this page.";
  if (run.status === "Running") return "We’re reading your document. You can work on other invoices or come back later. Any edits you make here are kept.";
  if (run.status === "Completed") return "Extraction is complete. Compare the details with your original, then save your invoice.";
  return "We couldn’t finish the extraction. Your original and any edits are safe. Check the history before retrying, or enter the details manually.";
}
