import assert from "node:assert/strict";
import test from "node:test";
import { isAnalysisActive, mergeAnalysisResult, mergeInvoiceResult, mergePolledAnalysis, nextReviewItem } from "../lib/workspace-state.ts";

const item = (id) => ({
  document: { id, originalFileName: `${id}.pdf`, contentType: "application/pdf", documentType: "Invoice", status: "Uploaded", uploadedAt: "2026-09-01T12:00:00Z" },
  invoice: null,
  latestRun: null,
});

const invoice = (documentId) => ({
  id: `invoice-${documentId}`, documentId, supplierName: "Atelier North", supplierAddress: null, supplierTaxId: null,
  invoiceNumber: "INV-0187", invoiceDate: "2026-09-01", dueDate: null, purchaseOrderNumber: null, currency: "EUR",
  subtotalAmount: 1200, taxAmount: 240, totalAmount: 1440, lines: [], createdAt: "2026-09-01T12:02:00Z", updatedAt: "2026-09-01T12:02:00Z",
});

const run = (documentId, status = "Completed") => ({
  id: `run-${documentId}`, documentId, status, processor: "test", processorVersion: null,
  startedAt: "2026-09-01T12:00:00Z", completedAt: "2026-09-01T12:00:01Z",
  errorCode: status === "Failed" ? "AnalysisFailed" : null, errorMessage: status === "Failed" ? "Analysis failed." : null, extractedFields: [],
});

test("analysis finishing after a save preserves the saved invoice and latest document metadata", () => {
  const initial = [item("A"), item("B")];
  const savedInvoice = invoice("A");
  const saved = mergeInvoiceResult(initial, "A", savedInvoice);
  saved[0] = { ...saved[0], document: { ...saved[0].document, originalFileName: "renamed-after-analysis-started.pdf" } };
  const beforeAnalysis = structuredClone(saved);
  const completedRun = run("A");

  const result = mergeAnalysisResult(saved, "A", completedRun);

  assert.deepEqual(result[0].invoice, savedInvoice);
  assert.deepEqual(result[0].latestRun, completedRun);
  assert.deepEqual(result[0].document, saved[0].document);
  assert.equal(result[0].document.status, "Saved");
  assert.deepEqual(result[1], initial[1]);
  assert.deepEqual(saved, beforeAnalysis);
  assert.equal(initial[0].invoice, null);
});

test("save finishing after analysis preserves the latest extraction and other documents", () => {
  const initial = [item("A"), item("B")];
  const completedRun = run("A");
  const analyzed = mergeAnalysisResult(initial, "A", completedRun);
  analyzed[0] = { ...analyzed[0], document: { ...analyzed[0].document, originalFileName: "latest-name.pdf" } };
  const beforeSave = structuredClone(analyzed);
  const savedInvoice = invoice("A");

  const result = mergeInvoiceResult(analyzed, "A", savedInvoice);

  assert.deepEqual(result[0].invoice, savedInvoice);
  assert.deepEqual(result[0].latestRun, completedRun);
  assert.deepEqual(result[0].document, { ...analyzed[0].document, status: "Saved" });
  assert.deepEqual(result[1], initial[1]);
  assert.deepEqual(analyzed, beforeSave);
  assert.equal(initial[0].latestRun, null);
});

test("failed reanalysis retains an already saved invoice and Saved status", () => {
  const savedInvoice = invoice("A");
  const saved = mergeInvoiceResult([item("A")], "A", savedInvoice);
  const failedRun = run("A", "Failed");

  const result = mergeAnalysisResult(saved, "A", failedRun);

  assert.deepEqual(result[0].invoice, savedInvoice);
  assert.equal(result[0].document.status, "Saved");
  assert.deepEqual(result[0].latestRun, failedRun);
});

test("next review advances A to B to C and wraps to A", () => {
  const items = [item("A"), item("B"), item("C")];
  assert.equal(nextReviewItem(items, items, "A")?.document.id, "B");
  assert.equal(nextReviewItem(items, items, "B")?.document.id, "C");
  assert.equal(nextReviewItem(items, items, "C")?.document.id, "A");
});

test("next review retains the current document position after it leaves the queue", () => {
  const items = [item("A"), item("B"), item("C"), item("D")];
  const saved = mergeInvoiceResult(items, "B", invoice("B"));
  const queue = saved.filter((row) => row.invoice === null && row.document.id !== "D");

  assert.equal(nextReviewItem(saved, queue, "B")?.document.id, "C");
  assert.equal(nextReviewItem(saved, queue, "C")?.document.id, "A");
});

test("a queue containing only the current document has no next item", () => {
  const items = [item("A"), item("B")];
  assert.equal(nextReviewItem(items, [items[0]], "A"), undefined);
  assert.equal(nextReviewItem([items[0]], [items[0]], "A"), undefined);
});

test("an empty queue has no next item", () => {
  assert.equal(nextReviewItem([item("A")], [], "A"), undefined);
  assert.equal(nextReviewItem([], [], null), undefined);
});

test("unknown or absent current selection starts at the first queued document", () => {
  const items = [item("A"), item("B"), item("C")];
  const queue = [items[1], items[2]];
  assert.equal(nextReviewItem(items, queue, "missing")?.document.id, "B");
  assert.equal(nextReviewItem(items, queue, null)?.document.id, "B");
});

test("queued analysis is active and stale polling cannot replace a newer run or undo completion", () => {
  const queued = { ...run("A", "Pending"), processor: "AzureDocumentIntelligence" };
  assert.equal(isAnalysisActive(queued), true);
  const initial = mergeAnalysisResult([item("A")], "A", queued);
  assert.equal(initial[0].document.status, "Queued");
  const completed = { ...queued, status: "Completed" };
  const finished = mergePolledAnalysis(initial, completed);
  assert.equal(finished[0].document.status, "ReviewRequired");
  assert.strictEqual(mergePolledAnalysis(finished, queued), finished);
  assert.strictEqual(mergePolledAnalysis(initial, { ...completed, id: "older-run" }), initial);
});

test("polling merges extraction into the latest saved invoice without losing user data", () => {
  const queued = { ...run("A", "Running"), processor: "AzureDocumentIntelligence" };
  const current = mergeInvoiceResult(mergeAnalysisResult([item("A")], "A", queued), "A", invoice("A"));
  const result = mergePolledAnalysis(current, { ...queued, status: "Completed" });
  assert.deepEqual(result[0].invoice, current[0].invoice);
  assert.equal(result[0].document.status, "Saved");
});

test("repeated polling and old completions cannot create a second result transition", () => {
  const initial = [{ ...item("A"), latestRun: { ...run("A", "Running"), processor: "AzureDocumentIntelligence" } }];
  const completed = { ...initial[0].latestRun, status: "Completed" };
  const result = mergePolledAnalysis(initial, completed);
  assert.notStrictEqual(result, initial);
  assert.strictEqual(mergePolledAnalysis(result, completed), result);
  const retry = mergeAnalysisResult(result, "A", { ...completed, id: "new-run", status: "Pending" });
  assert.strictEqual(mergePolledAnalysis(retry, completed), retry);
});
