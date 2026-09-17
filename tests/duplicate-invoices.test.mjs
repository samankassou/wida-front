import assert from "node:assert/strict";
import test from "node:test";
import { fileContentHash, findDuplicateInvoices } from "../lib/duplicate-invoices.ts";
import { createApiClient, DuplicateInvoiceError } from "../lib/api.ts";

const existing = { invoice: { id: "invoice-1", documentId: "document-1", supplierName: "Example Supplier", invoiceNumber: "INV-001", invoiceDate: "2026-09-01", currency: "EUR", totalAmount: 120 } };

test("matches case and whitespace differences, excludes self and preserves punctuation", () => {
  assert.equal(findDuplicateInvoices([existing], {supplierName:" example   SUPPLIER ",invoiceNumber:" inv-001 "}, "document-2").length, 1);
  for (const [supplierName,invoiceNumber,documentId] of [["Example Supplier","INV-001","document-1"],["Other","INV-001","document-2"],["Example Supplier","INV001","document-2"],["","","document-2"]]) {
    assert.equal(findDuplicateInvoices([existing], {supplierName,invoiceNumber}, documentId).length, 0);
  }
});

test("file identity uses contents, not name or size", async () => {
  const first = new File(["abc"], "invoice.pdf");
  assert.equal(await fileContentHash(first), await fileContentHash(new File(["abc"], "renamed.pdf")));
  assert.notEqual(await fileContentHash(first), await fileContentHash(new File(["xyz"], "invoice.pdf")));
});

test("API preserves duplicate details and only sends override when requested", async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return requests.at(-1).allowDuplicate
      ? Response.json(existing.invoice)
      : Response.json({code:"DUPLICATE_INVOICE",matches:[existing.invoice]}, {status:409});
  };
  try {
    const client = createApiClient();
    await assert.rejects(client.saveInvoice({documentId:"document-2"}), error => error instanceof DuplicateInvoiceError && error.matches[0].id === "invoice-1");
    assert.equal(requests[0].allowDuplicate, false);
    await client.saveInvoice({documentId:"document-2"}, undefined, true);
    assert.equal(requests[1].allowDuplicate, true);
  } finally { globalThis.fetch = original; }
});

test("upload response exposes duplicate and restored-original flags", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({id:"document-1",isDuplicate:true,originalRestored:true});
  try {
    const response = await createApiClient().uploadDocument(new File(["abc"], "invoice.pdf"));
    assert.equal(response.isDuplicate, true);
    assert.equal(response.originalRestored, true);
  } finally { globalThis.fetch = original; }
});
