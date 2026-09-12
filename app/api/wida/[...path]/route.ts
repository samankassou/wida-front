import { proxyRequest } from "@/lib/proxy";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path.join("/"), {
    apiUrl: process.env.WIDA_API_URL,
    clientIpHeader: process.env.WIDA_CLIENT_IP_HEADER,
    publicOrigin: process.env.WIDA_PUBLIC_ORIGIN,
    production: process.env.NODE_ENV === "production",
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
