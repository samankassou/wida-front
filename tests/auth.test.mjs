import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApiClient, fetchSession, logout } from "../lib/api.ts";
import { AUTH_CHANGE_KEY, announceAuthChange, isLogoutEvent, loginErrorMessage, refreshActiveSession } from "../lib/auth-state.ts";
import { clearLiveDrafts, hasLiveDrafts, loadDraft, removeDraft, saveDraft } from "../lib/storage.ts";

test("session requests use the same-origin cookie without persisting a token", async () => {
  const originalFetch = globalThis.fetch;
  const session = { authenticated: true, googleConfigured: true, user: { id: "owner-1", email: "pilot@example.test", displayName: "Pilot" }, csrfToken: "csrf-1" };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/wida/auth/session");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.has("X-CSRF-TOKEN"), false);
    return Response.json(session);
  };
  try { assert.deepEqual(await fetchSession(), session); }
  finally { globalThis.fetch = originalFetch; }
});

test("every authenticated mutation carries CSRF protection, including multipart upload and logout", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const session = { csrfToken: "csrf-a", onUnauthenticated: () => assert.fail("Unexpected session expiry") };
  globalThis.fetch = async (url, init) => {
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.headers.get("X-CSRF-TOKEN"), "csrf-a");
    calls.push([url, init]);
    return url.endsWith("logout") ? new Response(null, { status: 204 }) : Response.json({});
  };
  try {
    const client = createApiClient(session);
    await client.uploadDocument(new File(["invoice"], "invoice.pdf", { type: "application/pdf" }));
    await client.analyzeDocument("a/b");
    await client.saveInvoice({ documentId: "document-a" });
    await client.saveInvoice({ documentId: "document-a" }, "invoice-a");
    await logout(session);
    assert.deepEqual(calls.map(([url, init]) => [url, init.method]), [["/api/wida/documents", "POST"], ["/api/wida/processing/documents/a%2Fb/invoice", "POST"], ["/api/wida/invoices", "POST"], ["/api/wida/invoices/invoice-a", "PUT"], ["/api/wida/auth/logout", "POST"]]);
    assert.ok(calls[0][1].body instanceof FormData);
    assert.equal(calls[0][1].headers.has("Content-Type"), false, "Browser must supply multipart boundary");
    assert.equal(calls[2][1].headers.get("Content-Type"), "application/json");
  } finally { globalThis.fetch = originalFetch; }
});

test("401 expires the session without exposing an untrusted response body as workspace data", async () => {
  const originalFetch = globalThis.fetch;
  let expired = 0;
  const controller = new AbortController();
  const client = createApiClient({ csrfToken: "csrf-a", signal: controller.signal, onUnauthenticated: () => { expired++; controller.abort(); } });
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.signal, controller.signal);
    return Response.json({ detail: "private diagnostics" }, { status: 401 });
  };
  try {
    await assert.rejects(client.fetchWorkspace(), error => error instanceof ApiError && error.status === 401 && error.message.includes("same account") && !error.message.includes("private diagnostics"));
    assert.equal(expired, 1);
    assert.equal(controller.signal.aborted, true);
  } finally { globalThis.fetch = originalFetch; }
});

test("API clients keep tokens isolated when two session requests overlap", async () => {
  const originalFetch = globalThis.fetch;
  const tokens = [];
  globalThis.fetch = async (_url, init) => { tokens.push(init.headers.get("X-CSRF-TOKEN")); return Response.json({}); };
  try {
    const first = createApiClient({ csrfToken: "first", onUnauthenticated: () => {} });
    const second = createApiClient({ csrfToken: "second", onUnauthenticated: () => {} });
    await Promise.all([first.analyzeDocument("a"), second.analyzeDocument("b"), first.analyzeDocument("c")]);
    assert.deepEqual(tokens, ["first", "second", "first"]);
  } finally { globalThis.fetch = originalFetch; }
});

function memoryStorage() {
  return Object.defineProperties({}, {
    getItem: { value(key) { return Object.hasOwn(this, key) ? this[key] : null; } },
    setItem: { value(key, value) { this[key] = String(value); } },
    removeItem: { value(key) { delete this[key]; } },
  });
}

test("live drafts survive same-owner recovery and cannot be loaded or deleted by another owner", () => {
  const oldSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const oldLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: memoryStorage() });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
  try {
    const values = { supplierName: "First supplier", supplierAddress: "", supplierTaxId: "", invoiceNumber: "",
      invoiceDate: "", dueDate: "", purchaseOrderNumber: "", currency: "", shippingAmount: "", discountAmount: "",
      subtotalAmount: "", taxAmount: "", totalAmount: "", lines: [] };
    const first = { extractionRunId: null, values, checkedFields: [] };
    const second = { ...first, values: { ...values, supplierName: "Second supplier" } };
    assert.equal(saveDraft("doc", "live", first), false, "Live drafts require a verified owner");
    assert.equal(saveDraft("doc", "live", first, "owner:1"), true);
    assert.deepEqual(loadDraft("doc", "live", "owner:1"), first);
    for (const invalid of [
      { values, checkedFields: [] },
      { ...first, values: { ...values, shippingAmount: undefined } },
      { ...first, values: { ...values, discountAmount: undefined } },
      { ...first, values: { ...values, lines: [null] } },
      { ...first, checkedFields: [42] },
    ]) {
      saveDraft("invalid", "live", invalid, "owner:1");
      assert.equal(loadDraft("invalid", "live", "owner:1"), null, "Incomplete or malformed drafts are rejected");
    }
    removeDraft("invalid", "live", "owner:1");
    assert.equal(loadDraft("doc", "live", "owner:2"), null);
    assert.equal(loadDraft("doc", "live"), null);
    assert.equal(hasLiveDrafts("owner:1"), true);
    saveDraft("doc", "live", second, "owner:2");
    saveDraft("doc", "demo", first);
    removeDraft("doc", "live", "owner:2");
    assert.deepEqual(loadDraft("doc", "live", "owner:1"), first);
    saveDraft("doc", "live", second, "owner:2");
    clearLiveDrafts("owner:1");
    assert.equal(hasLiveDrafts("owner:1"), false);
    assert.deepEqual(loadDraft("doc", "live", "owner:2"), second);
    assert.deepEqual(loadDraft("doc", "demo"), first);
    clearLiveDrafts("owner:2");
    assert.equal(loadDraft("doc", "live", "owner:2"), null, "Cleared drafts must not load");
    assert.deepEqual(loadDraft("doc", "demo"), first, "Demo drafts are unaffected");
  } finally {
    if (oldSession) Object.defineProperty(globalThis, "sessionStorage", oldSession); else delete globalThis.sessionStorage;
    if (oldLocal) Object.defineProperty(globalThis, "localStorage", oldLocal); else delete globalThis.localStorage;
  }
});

test("login errors use actionable fixed copy and ignore arbitrary query content", () => {
  for (const code of ["not_invited", "authentication_failed", "configuration"]) {
    assert.ok(loginErrorMessage(code)?.trim());
  }
  assert.equal(loginErrorMessage("https://malicious.example"), null);
});

test("cross-tab changes contain no session token and repeated checks do not repeatedly invalidate other tabs", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
  try {
    announceAuthChange("owner-1");
    const first = localStorage.getItem(AUTH_CHANGE_KEY);
    assert.deepEqual(Object.keys(JSON.parse(first)).sort(), ["loggedOut", "nonce", "userId"]);
    announceAuthChange("owner-1");
    assert.equal(localStorage.getItem(AUTH_CHANGE_KEY), first);
    announceAuthChange("owner-2");
    assert.notEqual(localStorage.getItem(AUTH_CHANGE_KEY), first);
    assert.equal(isLogoutEvent(localStorage.getItem(AUTH_CHANGE_KEY)), false);
    announceAuthChange(null, true);
    assert.equal(isLogoutEvent(localStorage.getItem(AUTH_CHANGE_KEY)), true);
    assert.equal(isLogoutEvent("invalid json"), false);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original); else delete globalThis.localStorage;
  }
});

test("same-owner session renewal uses the refreshed CSRF token without aborting in-flight work", async () => {
  const originalFetch = globalThis.fetch;
  const user = { id: "owner-1", email: "pilot@example.test", displayName: "Pilot" };
  const initial = refreshActiveSession(null, { authenticated: true, googleConfigured: true, user, csrfToken: "old-token" });
  const renewed = refreshActiveSession(initial, { ...initial, csrfToken: "renewed-token" });
  assert.equal(renewed.controller, initial.controller);
  assert.equal(initial.controller.signal.aborted, false);
  assert.equal(renewed.user, initial.user, "The workspace keeps its current user and React key");
  assert.equal(refreshActiveSession(renewed, { ...renewed }), renewed, "Unchanged session checks do not replace the client context");
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.get("X-CSRF-TOKEN"), "renewed-token");
    assert.equal(init.signal, initial.controller.signal);
    return Response.json({});
  };
  try {
    await createApiClient({ csrfToken: renewed.csrfToken, signal: renewed.controller.signal, onUnauthenticated: () => assert.fail("Unexpected expiry") }).analyzeDocument("document-a");
    const changed = refreshActiveSession(renewed, { ...renewed, user: { ...user, id: "owner-2" }, csrfToken: "other-token" });
    assert.equal(initial.controller.signal.aborted, true, "Changing accounts cancels requests from the previous owner");
    assert.notEqual(changed.controller, renewed.controller);
    assert.equal(changed.controller.signal.aborted, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("role changes refresh the same user's UI without cancelling work", () => {
  const controller = new AbortController();
  const previous = { authenticated: true, googleConfigured: true, csrfToken: "token", controller, user: { id: "u", email: "user@example.com", displayName: "User", role: "User" } };
  const latest = { ...previous, user: { ...previous.user, role: "Admin" } };
  const refreshed = refreshActiveSession(previous, latest);
  assert.equal(refreshed.user.role, "Admin");
  assert.equal(refreshed.controller, controller);
  assert.equal(controller.signal.aborted, false);
});
