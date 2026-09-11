import test from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "../lib/api.ts";
import { proxyRequest } from "../lib/proxy.ts";

test("analysis only opts into paid reanalysis explicitly", async () => {
  const previous = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (path, init) => { paths.push(path); assert.equal(init.headers.get("X-CSRF-TOKEN"), "csrf"); return Response.json({ id: "run" }); };
  try {
    const client = createApiClient({ csrfToken: "csrf", onUnauthenticated() {} });
    await client.analyzeDocument("id");
    await client.analyzeDocument("id", true);
    assert.deepEqual(paths, ["/api/wida/processing/documents/id/invoice", "/api/wida/processing/documents/id/invoice?reanalyze=true"]);
  } finally { globalThis.fetch = previous; }
});

test("trial balance, credit and challenge routes pass through the protected proxy", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true });
  try {
    for (const [endpoint, method] of [["trial", "GET"], ["trial/credits", "POST"], ["trial/challenge", "POST"]]) {
      const response = await proxyRequest(new Request(`https://wida.test/api/wida/${endpoint}`, { method, headers: { origin: "https://wida.test" } }), endpoint,
        { apiUrl: "http://localhost:5085", publicOrigin: "https://wida.test", production: true });
      assert.equal(response.status, 200);
    }
  } finally { globalThis.fetch = previous; }
});
