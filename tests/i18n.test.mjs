import assert from "node:assert/strict";
import test from "node:test";
import { messages } from "../lib/translations.ts";
import { parseLocale, translate } from "../lib/i18n.ts";
import { money } from "../lib/money.ts";
import { createDraft, validateDraft } from "../lib/invoice-form.ts";

test("locale preferences accept French and English and safely fall back to French", () => {
  assert.equal(parseLocale("en"), "en");
  assert.equal(parseLocale("fr"), "fr");
  for (const value of [undefined, null, "", "de", "<script>"]) assert.equal(parseLocale(value), "fr");
});

test("both languages preserve message parameters and unknown content", () => {
  for (const message of Object.values(messages)) {
    assert.ok(message.en && message.fr);
    const parameters = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(parameters(message.fr), parameters(message.en), message.en);
  }
  assert.equal(translate("fr", "Upload {count} documents", { count: 3 }), "Importer 3 documents");
  assert.equal(translate("en", "Continuer avec Google"), "Continue with Google");
  assert.equal(translate("fr", "Acme INV-001"), "Acme INV-001");
  assert.equal(translate("fr", "Open {name}", { name: "{count}.pdf" }), "Ouvrir {count}.pdf");
});

test("changing the display language does not alter invoice amounts or drafts", () => {
  assert.equal(money(1234.5, "", "en-GB"), "1,234.50");
  assert.equal(money(1234.5, "", "fr-FR").replace(/\u202f/g, " "), "1 234,50");
  const item = { document: { id: "test" }, latestRun: null, invoice: null };
  const draft = createDraft(item);
  const before = structuredClone(draft);
  const french = validateDraft(draft, item, (message, values) => translate("fr", message, values));
  const english = validateDraft(draft, item, (message, values) => translate("en", message, values));
  assert.equal(french.supplierName, "Le champ « Nom du fournisseur » est obligatoire.");
  assert.equal(english.supplierName, "Supplier name is required.");
  assert.deepEqual(draft, before);
});
