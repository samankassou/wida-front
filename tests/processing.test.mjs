import assert from "node:assert/strict";
import test from "node:test";
import { analysisDescription, analysisLabel, analysisRequestMessage } from "../lib/processing.ts";

test("queue admission errors preserve the distinction between a saved upload and a failed analysis", () => {
  assert.match(analysisRequestMessage(429), /capacity is full/);
  assert.match(analysisRequestMessage(503), /temporarily unavailable/);
  assert.match(analysisRequestMessage(401), /Sign in again/);
  for (const status of [0, 500, undefined]) {
    assert.match(analysisRequestMessage(status), /could not confirm/);
    assert.match(analysisRequestMessage(status), /Refresh its status before retrying/);
  }
});

test("pending and running expose distinct stages without an invented ETA", () => {
  assert.equal(analysisLabel({ status: "Pending" }), "Waiting to start");
  assert.equal(analysisLabel({ status: "Running" }), "Extracting details");
  assert.match(analysisDescription({ status: "Pending" }), /leave this page/);
  assert.match(analysisDescription({ status: "Running" }), /edits.*kept/);
  assert.match(analysisDescription({ status: "Failed" }), /original and any edits are safe/);
});
