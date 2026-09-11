import type { ProcessingRun, WorkspaceItem } from "./types";

export interface UploadResult { item: WorkspaceItem; analysisError?: string }

export function analysisRequestMessage(status?: number): string {
  if (status === 429) return "Your document is saved. All analyses are busy. Try again shortly, or enter the details manually.";
  if (status === 503) return "Your document is saved. Analysis is temporarily unavailable. Try again later; no need to upload the file again.";
  if (status === 401) return "Your document is saved. Sign in again to check its analysis status.";
  return "Your document is saved, but we could not confirm the analysis request. Refresh its status before retrying; no need to upload it again.";
}

export function analysisLabel(run: ProcessingRun): string {
  return run.status === "Pending" ? "Waiting to start" : run.status === "Running" ? "Reading document" : run.status === "Completed" ? "Ready to review" : "Needs attention";
}

export function analysisDescription(run: ProcessingRun): string {
  if (run.status === "Pending") return "Your analysis will start automatically. You can leave this page.";
  if (run.status === "Running") return "We’re reading your document. You can work on other invoices or come back later. Any edits you make here are kept.";
  if (run.status === "Completed") return "Compare the details with your original, then save your invoice.";
  return "We couldn’t read the document. Your original and any edits are safe. Try again later or enter the details manually.";
}

export function analysisFailureMessage(run: ProcessingRun): string {
  switch (run.errorCode) {
    case "ANALYSIS_SUBMISSION_UNCERTAIN":
    case "ANALYSIS_EXPIRED":
    case "ANALYSIS_RETRY_EXHAUSTED":
      return "We couldn’t confirm the analysis result. It may have used pages from your balance. Check your balance before trying again.";
    case "AZURE_F0_LIMIT":
      return "Choose a file with no more than 2 pages and up to 4 MB, or enter the invoice details yourself.";
    case "TRIAL_RESERVATION_REQUIRED":
      return "This document needs to be uploaded again before it can be analysed. You can also enter its details yourself.";
    case "TRIAL_MONTHLY_LIMIT":
      return "Analyses are paused for this month. You can still enter invoice details yourself.";
    default:
      return "We couldn’t finish reading this document. Try again later or enter the details yourself.";
  }
}
