import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDocument, ApiError, normalizeFieldErrors } from "../lib/api.ts";

test("normalizes API validation field names and bracketed line paths", () => {
  assert.deepEqual(normalizeFieldErrors({ SupplierName: ["Supplier is required."], "Lines[0].LineAmount": ["Check the amount."], "lines[2].quantity": "Check quantity.", "$.InvoiceDate": ["Invalid date."] }), {
    supplierName: "Supplier is required.", "lines.0.lineAmount": "Check the amount.", "lines.2.quantity": "Check quantity.", invoiceDate: "Invalid date.",
  });
  assert.deepEqual(normalizeFieldErrors(null), {});
  assert.deepEqual(normalizeFieldErrors([]), {});
});

test("failed requests expose normalized field errors to the review form", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ title: "Validation failed", errors: { "Lines[0].UnitPrice": ["Enter a number."] } }), { status: 400, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(analyzeDocument("document-1"), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.message, "Validation failed");
      assert.deepEqual(error.errors, { "lines.0.unitPrice": "Enter a number." });
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
