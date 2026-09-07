const allowedPath = /^(?:documents(?:\/workspace|\/[a-f0-9-]+(?:\/content)?)?|invoices(?:\/[a-f0-9-]+|\/document\/[a-f0-9-]+)?|processing(?:\/[a-f0-9-]+|\/documents\/[a-f0-9-]+(?:\/invoice)?)?)$/i;

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const configured = process.env.WIDA_API_URL;
  if (!configured) return Response.json({ title: "API not connected", detail: "Set WIDA_API_URL on the frontend server to connect the Wida API." }, { status: 503 });
  const { path } = await context.params;
  const endpoint = path.join("/");
  if (!allowedPath.test(endpoint)) return Response.json({ title: "Unknown endpoint" }, { status: 404 });
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({ title: "Invalid request origin" }, { status: 403 });
  }
  try {
    const base = new URL(configured.endsWith("/") ? configured : `${configured}/`);
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid API URL");
    const url = new URL(`api/${endpoint}`, base);
    url.search = new URL(request.url).search;
    const headers = new Headers();
    for (const name of ["content-type", "range", "if-range"]) { const value = request.headers.get(name); if (value) headers.set(name, value); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), endpoint.endsWith("/invoice") ? 180_000 : 60_000);
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    let upstream: Response;
    try {
      upstream = await fetch(url, { method: request.method, headers, body: request.method === "GET" ? undefined : request.body, duplex: "half", cache: "no-store", redirect: "error", signal: controller.signal } as RequestInit);
    } finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "content-disposition", "content-length", "content-range", "accept-ranges", "x-content-type-options"]) { const value = upstream.headers.get(name); if (value) outgoing.set(name, value); }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return Response.json({ title: "Wida API is unavailable", detail: "We couldn't reach the API. Check the backend connection and try again. Your draft has been kept." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
