import assert from "node:assert/strict";
import test from "node:test";
import { money } from "../lib/money.ts";

const spaces = text => text.replace(/[\u00a0\u202f]/g, " ");

test("French amounts group thousands, use decimal commas and show currency once", () => {
  assert.equal(spaces(money(1440, "EUR")), "1 440,00 EUR");
  assert.equal(spaces(money(1234567.89, "USD")), "1 234 567,89 USD");
  assert.equal(spaces(money(-42.5, " eur ")), "-42,50 EUR");
  assert.equal(spaces(money(0, "EUR")), "0,00 EUR");
});

test("currency precision follows the currency, including CFA francs", () => {
  assert.equal(spaces(money(150000, "XAF")), "150 000 XAF");
  assert.equal(spaces(money(1.234, "KWD")), "1,234 KWD");
});

test("missing or invalid data never displays NaN, infinity or a made-up currency", () => {
  for (const amount of [null, NaN, Infinity, -Infinity]) assert.equal(money(amount, "EUR"), "—");
  assert.equal(spaces(money(1234.5)), "1 234,50");
  assert.equal(spaces(money(1234.5, "not-a-currency")), "1 234,50");
});
