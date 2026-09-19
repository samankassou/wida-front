import assert from "node:assert/strict";
import test from "node:test";
import { csvValue } from "../lib/csv.ts";
import { createDraft, toInvoicePayload, validateDraft } from "../lib/invoice-form.ts";

test("valid credit invoice amounts export without text prefixes", () => {
  const item = { document: { id: "credit", status: "Uploaded" }, invoice: null, latestRun: null };
  const draft = createDraft(item);
  Object.assign(draft.values, {
    supplierName: "Credit supplier", invoiceNumber: "CREDIT-001", invoiceDate: "2026-09-19",
    currency: "EUR", subtotalAmount: "-100", taxAmount: "-20", totalAmount: "-120",
  });
  assert.deepEqual(validateDraft(draft, item), {});
  const invoice = toInvoicePayload(draft.values, item.document.id);
  assert.equal([invoice.subtotalAmount, invoice.taxAmount, invoice.totalAmount].map(csvValue).join(","), '"-100","-20","-120"');
  assert.equal(csvValue(0), '"0"');
  assert.equal(csvValue(120.25), '"120.25"');
});

test("formula-like text stays protected, including negative-looking identifiers", () => {
  for (const value of ["=1+1", "+SUM(A1)", "@SUM(A1)", "-120", "  =1+1", "\t-1+2", "\n@SUM(A1)"]) {
    assert.equal(csvValue(value), `"'${value}"`);
  }
});

test("CSV preserves quotes, commas, newlines, dates, and empty optional values", () => {
  assert.equal(csvValue('Supplier, "North"\nOffice'), '"Supplier, ""North""\nOffice"');
  assert.equal(csvValue("2026-09-19"), '"2026-09-19"');
  assert.equal(csvValue(null), '""');
  assert.equal(csvValue(undefined), '""');
});
