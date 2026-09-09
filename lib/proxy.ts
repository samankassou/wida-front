interface ProxyConfiguration { apiUrl?: string; publicOrigin?: string; production?: boolean }

const dataPath = /^(?:documents(?:\/workspace|\/[a-f0-9-]+(?:\/content)?)?|invoices(?:\/[a-f0-9-]+|\/document\/[a-f0-9-]+)?|processing(?:\/[a-f0-9-]+|\/documents\/[a-f0-9-]+(?:\/invoice)?)?)$/i;
const authMethods: Record<string, string> = { "auth/session": "GET", "auth/login": "GET", "auth/callback": "GET", "auth/logout": "POST" };
const redirectCodes = new Set([301, 302, 303, 307, 308]);

function widaCookies(value: string | null): string {
  return (value ?? "").split(";").map(part => part.trim()).filter(part => /^Wida\.[^=\s;]+=/.test(part)).join("; ");
}

function validRedirect(location: string, endpoint: string, origin: string): boolean {
  try {
    const url = new URL(location, origin);
    if (url.username || url.password) return false;
    if (url.origin === origin && (url.pathname === "/" || url.pathname === "/login")) return true;
    return endpoint === "auth/login" && url.origin === "https://accounts.google.com"
      && ["/o/oauth2/v2/auth", "/o/oauth2/auth"].includes(url.pathname);
  } catch { return false; }
}

export async function proxyRequest(request: Request, endpoint: string, configuration: ProxyConfiguration): Promise<Response> {
  if (!configuration.apiUrl) return Response.json({ title: "API not connected" }, { status: 503 });
  const authMethod = authMethods[endpoint];
  if (!authMethod && !dataPath.test(endpoint)) return Response.json({ title: "Unknown endpoint" }, { status: 404 });
  if (authMethod && request.method !== authMethod) return Response.json({ title: "Method not allowed" }, { status: 405, headers: { Allow: authMethod } });

  try {
    if (configuration.production && !configuration.publicOrigin) throw new Error("Public origin required");
    const publicUrl = new URL(configuration.publicOrigin ?? new URL(request.url).origin);
    if (publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password
      || !["http:", "https:"].includes(publicUrl.protocol)
      || (configuration.production && publicUrl.protocol !== "https:")) throw new Error("Invalid public origin");
    const origin = publicUrl.origin;
    if (request.method !== "GET" && request.headers.get("origin") !== origin)
      return Response.json({ title: "Invalid request origin" }, { status: 403 });

    const base = new URL(configuration.apiUrl);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.pathname !== "/" || base.search || base.hash)
      throw new Error("Invalid API origin");
    const url = new URL(`api/${endpoint}`, base);
    url.search = new URL(request.url).search;
    const headers = new Headers();
    for (const name of ["content-type", "range", "if-range", "x-csrf-token"]) {
      const value = request.headers.get(name); if (value) headers.set(name, value);
    }
    const cookies = widaCookies(request.headers.get("cookie"));
    if (cookies) headers.set("cookie", cookies);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), endpoint.endsWith("/invoice") ? 180_000 : 60_000);
    const abort = () => controller.abort();
    if (request.signal.aborted) controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    let upstream: Response;
    try {
      upstream = await fetch(url, { method: request.method, headers,
        body: request.method === "GET" ? undefined : request.body,
        duplex: "half", cache: "no-store", redirect: "manual", signal: controller.signal } as RequestInit);
    } finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }

    const outgoing = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    if (redirectCodes.has(upstream.status)) {
      const location = upstream.headers.get("location");
      if (!["auth/login", "auth/callback"].includes(endpoint) || !location || !validRedirect(location, endpoint, origin)) {
        await upstream.body?.cancel();
        return Response.json({ title: "Unexpected API redirect" }, { status: 502, headers: outgoing });
      }
      outgoing.set("location", new URL(location, origin).href);
    }
    for (const cookie of upstream.headers.getSetCookie()) {
      if (/^Wida\.[^=\s;]+=/.test(cookie)) outgoing.append("set-cookie", cookie);
    }
    for (const name of ["content-type", "content-disposition", "content-length", "content-range", "accept-ranges", "x-content-type-options"]) {
      const value = upstream.headers.get(name); if (value) outgoing.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return Response.json({ title: "Wida API is unavailable", detail: "We couldn't reach the API. Please try again. Your draft has been kept." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
