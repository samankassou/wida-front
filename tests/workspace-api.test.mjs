import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "../lib/api.ts";
import { proxyRequest } from "../lib/proxy.ts";

test("workspace sends pagination, search, filters and sort to the server", async (t) => {
  const query = { page: 3, pageSize: 25, search: "A & B", filter: "review", view: "documents", currency: "EUR", period: "30", sort: "supplier" };
  const page = { items: [], total: 52, page: 3, pageSize: 25 };
  t.mock.method(globalThis, "fetch", async (path, init) => {
    const url = new URL(path, "http://localhost");
    assert.equal(url.pathname, "/api/wida/documents/workspace/page");
    for (const [key, value] of Object.entries(query)) assert.equal(url.searchParams.get(key), String(value));
    assert.equal(init.cache, "no-store");
    return Response.json(page);
  });
  assert.deepEqual(await createApiClient().fetchWorkspace(query), page);
});

test("workspace requests combine query cancellation and session cancellation", async (t) => {
  const session = new AbortController();
  const query = new AbortController();
  let signal;
  t.mock.method(globalThis, "fetch", async (_path, init) => { signal = init.signal; return Response.json({ items: [] }); });
  const client = createApiClient({ csrfToken: "token", onUnauthenticated() {}, signal: session.signal });
  await client.fetchWorkspace({}, query.signal);
  query.abort();
  assert.equal(signal.aborted, true);
  await client.fetchWorkspace({}, new AbortController().signal);
  session.abort();
  assert.equal(signal.aborted, true);
});

test("proxy allows workspace page and detail routes and preserves query parameters", async (t) => {
  const config = { apiUrl: "http://localhost:5085", publicOrigin: "http://localhost:3000" };
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.search, "?page=2&sort=oldest&search=a%26b");
    return Response.json({ items: [] });
  });
  for (const endpoint of ["documents/workspace/page", "documents/workspace/01234567-0123-0123-0123-0123456789ab"]) {
    const response = await proxyRequest(new Request(`http://localhost:3000/api/wida/${endpoint}?page=2&sort=oldest&search=a%26b`), endpoint, config);
    assert.equal(response.status, 200);
  }
});

test("document deletion sends CSRF protection and accepts an empty 204 response", async (t) => {
  t.mock.method(globalThis, "fetch", async (path, init) => {
    assert.equal(path, "/api/wida/documents/document-id");
    assert.equal(init.method, "DELETE");
    assert.equal(init.headers.get("X-CSRF-TOKEN"), "delete-token");
    assert.equal(init.credentials, "same-origin");
    return new Response(null, { status: 204 });
  });
  await createApiClient({ csrfToken: "delete-token", onUnauthenticated() {} }).deleteDocument("document-id");
});

test("proxy forwards document deletion with its CSRF token and empty response", async (t) => {
  const endpoint = "documents/01234567-0123-0123-0123-0123456789ab";
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url.pathname, `/api/${endpoint}`);
    assert.equal(init.method, "DELETE");
    assert.equal(init.headers.get("X-CSRF-TOKEN"), "delete-token");
    return new Response(null, { status: 204 });
  });
  const response = await proxyRequest(new Request(`http://localhost:3000/api/wida/${endpoint}`, {
    method: "DELETE", headers: { Origin: "http://localhost:3000", "X-CSRF-TOKEN": "delete-token" },
  }), endpoint, { apiUrl: "http://localhost:5085", publicOrigin: "http://localhost:3000" });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});
