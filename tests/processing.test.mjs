import assert from "node:assert/strict";
import test from "node:test";
import { analysisDescription, analysisFailureMessage, analysisLabel, analysisRequestMessage } from "../lib/processing.ts";

test("queue admission errors preserve the distinction between a saved upload and a failed analysis", () => {
  assert.match(analysisRequestMessage(429), /Try again shortly/);
  assert.match(analysisRequestMessage(503), /temporarily unavailable/);
  assert.match(analysisRequestMessage(401), /Sign in again/);
  for (const status of [0, 500, undefined]) {
    assert.match(analysisRequestMessage(status), /could not confirm/);
    assert.match(analysisRequestMessage(status), /Refresh its status before retrying/);
  }
});

test("pending and running expose distinct stages without an invented ETA", () => {
  assert.equal(analysisLabel({ status: "Pending" }), "Waiting to start");
  assert.equal(analysisLabel({ status: "Running" }), "Reading document");
  assert.match(analysisDescription({ status: "Pending" }), /leave this page/);
  assert.match(analysisDescription({ status: "Running" }), /edits.*kept/);
  assert.match(analysisDescription({ status: "Failed" }), /original and any edits are safe/);
});

test("analysis failures explain the next step without exposing provider diagnostics", () => {
  assert.match(analysisFailureMessage({ errorCode: "ANALYSIS_SUBMISSION_UNCERTAIN" }), /used pages.*Check your balance/);
  assert.match(analysisFailureMessage({ errorCode: "AZURE_F0_LIMIT" }), /2 pages/);
  assert.match(analysisFailureMessage({ errorCode: "TRIAL_MONTHLY_LIMIT" }), /paused for this month/);
  assert.match(analysisFailureMessage({ errorCode: "TRIAL_RESERVATION_REQUIRED" }), /uploaded again/);
  assert.doesNotMatch(analysisFailureMessage({ errorCode: "UNKNOWN", errorMessage: "Azure internal error" }), /Azure|UNKNOWN/);
});
