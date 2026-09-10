import assert from "node:assert/strict";
import test from "node:test";
import { createDraft, fieldNeedsCheck, getExtractedCurrency, numericValue, resolveDraft, toInvoicePayload, validateDraft } from "../lib/invoice-form.ts";

const field = (fieldName, normalizedValue, confidence = 0.98) => ({
  id: fieldName, fieldName, normalizedValue, confidence, rawValue: null,
  source: "DocumentIntelligence", pageNumber: 1, boundingBox: null, requiresReview: confidence === null || confidence < 0.8,
});

const item = () => ({
  document: { id: "document-1", originalFileName: "invoice.pdf", contentType: "application/pdf", documentType: "Invoice", status: "Processed", uploadedAt: "2026-09-01T12:00:00Z" },
  invoice: null,
  latestRun: { id: "run-1", documentId: "document-1", status: "Completed", processor: "test", processorVersion: null, startedAt: "2026-09-01T12:00:00Z", completedAt: "2026-09-01T12:00:01Z", errorCode: null, errorMessage: null,
    extractedFields: [field("VendorName", "Atelier North"), field("InvoiceId", "INV-0187", 0.72), field("InvoiceDate", "2026-09-01"), field("DueDate", "2026-09-30"), field("SubTotal", { amount: 1200, currencyCode: "EUR" }), field("TotalTax", 240), field("InvoiceTotal", { amount: 1440, currencyCode: "EUR" })] },
});

function checkedDraft(source = item()) {
  const draft = createDraft(source);
  draft.checkedFields = ["invoiceNumber"];
  return draft;
}

test("initializes all fields while preserving extraction uncertainty and a reliable currency", () => {
  const source = item();
  source.latestRun.extractedFields = source.latestRun.extractedFields.filter((entry) => entry.fieldName !== "VendorName");
  const draft = createDraft(source);
  assert.equal(draft.values.supplierName, "");
  assert.equal(draft.values.subtotalAmount, "1200");
  assert.equal(draft.values.totalAmount, "1440");
  assert.equal(draft.values.currency, "EUR");
  assert.equal(draft.values.supplierTaxId, "");
  assert.deepEqual(draft.values.lines, []);
  assert.deepEqual(draft.checkedFields, []);
  assert.ok(validateDraft(draft, source).supplierName);
  assert.ok(validateDraft(draft, source).invoiceNumber);
});

test("currency prefilling accepts only confident three-letter currency codes and permits overrides", () => {
  const source = item();
  const total = source.latestRun.extractedFields.find((entry) => entry.fieldName === "InvoiceTotal");
  total.normalizedValue.currencyCode = " xaf ";
  assert.equal(getExtractedCurrency(source), "XAF");
  const draft = checkedDraft(source);
  draft.values.currency = "USD";
  assert.equal(toInvoicePayload(draft.values, source.document.id).currency, "USD");
  for (const value of ["EURO", "12X", null, 978, ""]) {
    total.normalizedValue.currencyCode = value;
    assert.equal(createDraft(source).values.currency, "");
  }
  total.normalizedValue.currencyCode = "EUR";
  total.confidence = 0.72;
  assert.equal(createDraft(source).values.currency, "");
});

test("an edited low-confidence value still requires an explicit check", () => {
  const source = item();
  const draft = createDraft(source);
  draft.values.invoiceNumber = "INV-0137";
  assert.match(validateDraft(draft, source).invoiceNumber, /mark it checked/);
  draft.checkedFields = ["invoiceNumber"];
  assert.deepEqual(validateDraft(draft, source), {});
  assert.equal(source.latestRun.extractedFields[1].confidence, 0.72);
});

test("confidence threshold includes unknown confidence but excludes exactly 80 percent", () => {
  assert.equal(fieldNeedsCheck(field("InvoiceId", "A", null)), true);
  assert.equal(fieldNeedsCheck(field("InvoiceId", "A", 0.799)), true);
  assert.equal(fieldNeedsCheck(field("InvoiceId", "A", 0.8)), false);
  assert.equal(fieldNeedsCheck(undefined), false);
});

test("rejects whitespace, impossible dates, and due dates before invoice date", () => {
  const source = item();
  const draft = checkedDraft(source);
  draft.values.supplierName = "   ";
  draft.values.invoiceDate = "2026-02-30";
  let errors = validateDraft(draft, source);
  assert.ok(errors.supplierName);
  assert.ok(errors.invoiceDate);
  draft.values.invoiceDate = "2026-09-01";
  draft.values.dueDate = "2026-08-31";
  errors = validateDraft(draft, source);
  assert.match(errors.dueDate, /before/);
});

test("matches the API's inclusive one-cent arithmetic tolerance without floating point drift", () => {
  const source = item();
  const draft = checkedDraft(source);
  draft.values.subtotalAmount = "0.1";
  draft.values.taxAmount = "0.2";
  draft.values.totalAmount = "0.31";
  assert.equal(validateDraft(draft, source).totalAmount, undefined);
  draft.values.totalAmount = "0.3101";
  assert.ok(validateDraft(draft, source).totalAmount);
});

test("checks each line multiplication and the combined line subtotal", () => {
  const source = item();
  const draft = checkedDraft(source);
  draft.values.lines = [{ id: "line", description: "Design", quantity: "2", unitPrice: "600", lineAmount: "1100", taxRate: "", taxAmount: "", unitOfMeasure: "" }];
  let errors = validateDraft(draft, source);
  assert.ok(errors["lines.0.lineAmount"]);
  assert.ok(errors.subtotalAmount);
  draft.values.lines[0].lineAmount = "1200";
  errors = validateDraft(draft, source);
  assert.deepEqual(errors, {});
});

test("payload trims optional text, keeps zero amounts, uppercases currency, and omits UI line ids", () => {
  const draft = checkedDraft();
  draft.values.supplierName = "  Atelier North  ";
  draft.values.supplierAddress = "   ";
  draft.values.taxAmount = "0";
  draft.values.currency = " eur ";
  draft.values.lines = [{ id: "client-only", description: " Item ", quantity: "2", unitPrice: "0", lineAmount: "0", taxRate: "", taxAmount: "", unitOfMeasure: "" }];
  const payload = toInvoicePayload(draft.values, "document-1");
  assert.equal(payload.supplierName, "Atelier North");
  assert.equal(payload.supplierAddress, null);
  assert.equal(payload.taxAmount, 0);
  assert.equal(payload.currency, "EUR");
  assert.equal(payload.lines[0].lineNumber, 1);
  assert.equal(payload.lines[0].id, undefined);
  assert.equal(payload.lines[0].unitPrice, 0);
  assert.equal(numericValue("Infinity"), null);
  assert.equal(numericValue("1,2"), null);
});

test("saved invoices initialize from the saved record and retain reviewed extraction flags", () => {
  const source = item();
  const original = checkedDraft(source);
  source.invoice = { ...toInvoicePayload(original.values, source.document.id), id: "invoice-1", invoiceNumber: "CORRECTED-0137", createdAt: "2026-09-01T12:02:00Z", updatedAt: "2026-09-01T12:02:00Z" };
  const draft = createDraft(source);
  assert.equal(draft.values.invoiceNumber, "CORRECTED-0137");
  assert.ok(draft.checkedFields.includes("invoiceNumber"));
  assert.deepEqual(validateDraft(draft, source), {});
});


test("untouched forms follow a successful retry and subsequent extraction results", () => {
  const source = item();
  source.latestRun = { ...source.latestRun, id: "failed-run", status: "Failed", extractedFields: [] };
  assert.equal(resolveDraft(source).values.supplierName, "");
  source.latestRun = item().latestRun;
  assert.equal(resolveDraft(source).values.supplierName, "Atelier North");
  source.latestRun = { ...source.latestRun, id: "new-run", extractedFields: [field("VendorName", "New supplier")] };
  assert.equal(resolveDraft(source).values.supplierName, "New supplier");
});

test("new extraction preserves user edits but invalidates checks, including restored drafts", () => {
  const source = item();
  const edited = checkedDraft(source);
  edited.values.supplierName = "User correction";
  assert.equal(resolveDraft(source, edited), edited);
  source.latestRun = { ...source.latestRun, id: "replacement-run" };
  for (const draft of [edited, JSON.parse(JSON.stringify(edited)), { values: edited.values, checkedFields: edited.checkedFields }]) {
    const resolved = resolveDraft(source, draft);
    assert.equal(resolved.values.supplierName, "User correction");
    assert.deepEqual(resolved.checkedFields, []);
    assert.equal(resolved.extractionRunId, "replacement-run");
    assert.ok(validateDraft(resolved, source).invoiceNumber);
  }
  assert.deepEqual(edited.checkedFields, ["invoiceNumber"], "Resolving must not mutate a stored draft");
});
