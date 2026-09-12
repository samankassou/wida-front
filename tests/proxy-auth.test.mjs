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

test("admin endpoints preserve API authorization and CSRF protection", async (t) => {
  const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(url.pathname, /^\/api\/admin\//);
    if (init.method === "PUT") assert.equal(init.headers.get("x-csrf-token"), "csrf");
    return Response.json({ title: "Access denied" }, { status: 403 });
  });
  for (const path of ["admin/metrics", "admin/users", `admin/users/${id}/trial`]) {
    const init = path.endsWith("trial") ? { method: "PUT", headers: { origin: config.publicOrigin, "X-CSRF-TOKEN": "csrf" }, body: "{}" } : {};
    assert.equal((await proxyRequest(request(path, init), path, config)).status, 403);
  }
  assert.equal((await proxyRequest(request("admin/secrets"), "admin/secrets", config)).status, 404);
});

test("only the configured ingress IP is forwarded, replacing caller-supplied IP headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, init) => {
    assert.equal(init.headers.get("x-wida-client-ip"), "192.0.2.10");
    assert.equal(init.headers.get("x-forwarded-for"), null);
    return Response.json({});
  });
  const response = await proxyRequest(request("auth/session", { headers: {
    "x-real-ip": "192.0.2.10", "x-wida-client-ip": "192.0.2.99", "x-forwarded-for": "192.0.2.99",
  } }), "auth/session", { ...config, clientIpHeader: "x-real-ip" });
  assert.equal(response.status, 200);
});

test("production refuses missing configuration and invalid ingress IPs before contacting API", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not fetch"); });
  const production = { ...config, publicOrigin: "https://wida.example", production: true };
  assert.equal((await proxyRequest(request("auth/session"), "auth/session", production)).status, 503);
  for (const value of [undefined, "not-an-ip", "192.0.2.1, 192.0.2.2", "127.1", "fe80::1%eth0"]) {
    const headers = new Headers();
    if (value) headers.set("x-real-ip", value);
    const response = await proxyRequest(request("auth/session", { headers }), "auth/session", {
      ...production, clientIpHeader: "x-real-ip",
    });
    assert.equal(response.status, 503);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("development without trusted ingress configuration ignores all client IP headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, init) => {
    assert.equal(init.headers.get("x-wida-client-ip"), null);
    assert.equal(init.headers.get("x-forwarded-for"), null);
    return Response.json({});
  });
  assert.equal((await proxyRequest(request("auth/session", { headers: {
    "x-real-ip": "192.0.2.99", "x-wida-client-ip": "192.0.2.99", "x-forwarded-for": "192.0.2.99",
  } }), "auth/session", config)).status, 200);
});
