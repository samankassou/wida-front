import assert from "node:assert/strict";
import test from "node:test";
import { proxyRequest } from "../lib/proxy.ts";

const config = { apiUrl: "http://localhost:5085", publicOrigin: "http://localhost:3000" };
const request = (path, init) => new Request(`http://localhost:3000/api/wida/${path}`, init);

test("proxy forwards only Wida cookies and preserves separate Set-Cookie headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url.href, "http://localhost:5085/api/auth/session");
    assert.equal(init.headers.get("cookie"), "Wida.Session=opaque; Wida.Antiforgery=csrf");
    assert.equal(init.redirect, "manual");
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", "Wida.Session=new; Path=/; HttpOnly; SameSite=Lax");
    headers.append("Set-Cookie", "Wida.Antiforgery=next; Path=/; HttpOnly");
    headers.append("Set-Cookie", "unrelated=discard");
    return new Response("{}", { headers });
  });
  const response = await proxyRequest(request("auth/session", { headers: { Cookie: "secret=hidden; Wida.Session=opaque; Wida.Antiforgery=csrf" } }), "auth/session", config);
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("Google redirects are returned to the browser without fetching Google", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 302, headers: { Location: "https://accounts.google.com/o/oauth2/v2/auth?state=opaque", "Set-Cookie": "Wida.Correlation.id=value; Path=/; HttpOnly" } }));
  const response = await proxyRequest(request("auth/login"), "auth/login", config);
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^https:\/\/accounts.google.com\//);
  assert.equal(response.headers.getSetCookie().length, 1);
  assert.equal(mock.mock.callCount(), 1);
});

test("only auth callbacks may redirect home and unexpected hosts are rejected", async (t) => {
  let location = "http://localhost:3000/?document=abc";
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 302, headers: { Location: location } }));
  assert.equal((await proxyRequest(request("auth/callback?code=code&state=opaque"), "auth/callback", config)).status, 302);
  assert.equal((await proxyRequest(request("documents"), "documents", config)).status, 502);
  location = "https://evil.example/login";
  assert.equal((await proxyRequest(request("auth/callback"), "auth/callback", config)).status, 502);
  location = "https://accounts.google.com.evil.example/o/oauth2/v2/auth";
  assert.equal((await proxyRequest(request("auth/login"), "auth/login", config)).status, 502);
});

test("cross-origin and missing-origin writes fail before contacting API", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not fetch"); });
  for (const origin of [undefined, "https://evil.example"]) {
    const headers = new Headers(); if (origin) headers.set("Origin", origin);
    assert.equal((await proxyRequest(request("auth/logout", { method: "POST", headers }), "auth/logout", config)).status, 403);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("mutation forwards the antiforgery token and keeps backend status", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, init) => {
    assert.equal(init.headers.get("x-csrf-token"), "bound-token");
    return new Response('{"title":"Authentication required"}', { status: 401 });
  });
  const response = await proxyRequest(request("auth/logout", { method: "POST", headers: { Origin: config.publicOrigin, "X-CSRF-TOKEN": "bound-token" } }), "auth/logout", config);
  assert.equal(response.status, 401);
});

test("unknown auth paths, unsafe methods and unconfigured production fail closed", async () => {
  assert.equal((await proxyRequest(request("auth/backdoor"), "auth/backdoor", config)).status, 404);
  assert.equal((await proxyRequest(request("auth/logout"), "auth/logout", config)).status, 405);
  assert.equal((await proxyRequest(request("auth/session"), "auth/session", { apiUrl: config.apiUrl, production: true })).status, 502);
});
