import type { Invoice, ProcessingRun, WorkspaceItem } from "./types";

export function mergeInvoiceResult(items: WorkspaceItem[], documentId: string, invoice: Invoice): WorkspaceItem[] {
  return items.map(item => item.document.id === documentId
    ? { ...item, invoice, document: { ...item.document, documentType: "Invoice", status: "Saved" } }
    : item);
}

export function mergeAnalysisResult(items: WorkspaceItem[], documentId: string, run: ProcessingRun): WorkspaceItem[] {
  return items.map(item => item.document.id === documentId
    ? { ...item, latestRun: run, document: { ...item.document, documentType: "Invoice", status: item.invoice ? "Saved" : run.status === "Completed" ? "ReviewRequired" : run.status === "Failed" ? "Failed" : run.status === "Pending" ? "Queued" : "Processing" } }
    : item);
}

export function nextReviewItem(items: WorkspaceItem[], queue: WorkspaceItem[], selectedId: string | null): WorkspaceItem | undefined {
  const currentIndex = items.findIndex(item => item.document.id === selectedId);
  const queuedIds = new Set(queue.map(item => item.document.id));
  if (currentIndex === -1) return queue.find(item => item.document.id !== selectedId);
  // Use the full list so saving the current document does not lose its queue position.
  for (let offset = 1; offset < items.length; offset++) {
    const candidate = items[(currentIndex + offset) % items.length];
    if (queuedIds.has(candidate.document.id)) return candidate;
  }
  return undefined;
}

export function isAnalysisActive(run: ProcessingRun | null | undefined): boolean {
  return run?.processor === "AzureDocumentIntelligence" && (run.status === "Pending" || run.status === "Running");
}

// Ignore a poll from an older run or one that would undo a terminal result.
export function mergePolledAnalysis(items: WorkspaceItem[], run: ProcessingRun): WorkspaceItem[] {
  const current = items.find(item => item.document.id === run.documentId)?.latestRun;
  return current?.id === run.id && isAnalysisActive(current)
    ? mergeAnalysisResult(items, run.documentId, run) : items;
}
