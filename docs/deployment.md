# Deploying the frontend

The frontend runs a Next.js server, including the `/api/wida/...` proxy. Use a Next.js-capable host such as Vercel; a static export cannot provide connected mode. For local setup and runtime versions, see the [README](../README.md).

## Vercel with the Render API

Deploy the `wida-front` repository as a Next.js project. In Vercel project **Settings → Environment Variables**, set these values for **Production**, then redeploy:

| Variable | Value |
| --- | --- |
| `WIDA_API_URL` | Complete HTTPS API origin, e.g. `https://YOUR_API.onrender.com`, without `/api` |
| `WIDA_PUBLIC_ORIGIN` | Complete canonical frontend origin, e.g. `https://YOUR_FRONTEND_DOMAIN` |
| `WIDA_PROXY_SECRET` | Exactly the same secret as Render `Authentication__ProxySecret`, at least 32 characters |
| `WIDA_CLIENT_IP_HEADER` | `x-vercel-forwarded-for` |

These are server-side settings. Never prefix the secret with `NEXT_PUBLIC_`. A bare hostname without `https://` is invalid. The [Vercel request-header reference](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for) documents the IP header used by the proxy.

On Render, `Authentication__PublicOrigin` must equal `WIDA_PUBLIC_ORIGIN`. In Google OAuth, register exactly `https://YOUR_FRONTEND_DOMAIN/api/wida/auth/callback`. Google, PostgreSQL, Supabase, RabbitMQ and Azure credentials belong only to the API. See the [backend setup and secrets](https://github.com/samankassou/wida-api/blob/main/docs/render-free.md).

Use the configured canonical domain for sign-in and mutations. Preview deployments need their own coordinated frontend origin, API settings and registered OAuth callback; do not assume production values work on arbitrary preview URLs. Environment changes apply to a new deployment, not an already running deployment.

## Other hosting

Use the same API and public-origin settings. Set `WIDA_CLIENT_IP_HEADER` to a single-IP header overwritten by your trusted ingress; Next.js must only be reachable through it. An Nginx instance directly receiving client connections can set `X-Real-IP` to `$remote_addr`. Do not trust an arbitrary forwarded IP chain.

The public Render API authenticates the proxy with `WIDA_PROXY_SECRET` over HTTPS. An alternative private-network deployment can trust fixed Next.js peer addresses through API `RateLimiting__TrustedProxies__0` instead. User cookies, ownership and CSRF remain required in either mode.

## Browser demo

Leave `WIDA_API_URL` unset to run without a backend. `/` is the landing page; `/demo` always remains public, including in connected deployments. Demo records persist in browser storage and user-uploaded originals in IndexedDB. New demo uploads use manual entry; extraction examples are fictional.

## Verify the deployment

1. Open API `/healthz`: expect `200 ok`. This only checks HTTP liveness.
2. Open frontend `/api/wida/auth/session`: expect `200` JSON. In a fresh browser, `authenticated: false` and `googleConfigured: true` is a normal anonymous session. A failed request does not establish whether an existing login is valid.
3. Sign in through `/login`: Google should return to `/workspace`. Verify the profile, then return to `/`: the primary button becomes “Mon espace” (“My workspace” in English). Sign out and verify “Commencer” returns, including in another tab.
4. Upload, preview, analyze, correct, save, reload and export a fictional invoice. Check isolation with two accounts and session expiry. Follow the [browser checklist](development.md#manual-browser-checklist).

Render Free can sleep; API and worker resume only when the service wakes. The proxy times out after 60 seconds for most requests and 180 seconds for analysis admission. The frontend host's own function duration and request-size limits still apply. Retry session reads after waking the API; before retrying a mutation, check whether the upload or job already exists.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `Wida API is unavailable` / `502` | Both URL settings include `https://`, API DNS/TLS works, secret is at least 32 characters, and the deployment includes the latest values. Check Vercel and Render logs; allow a sleeping API to wake. |
| `Client IP configuration required` or `Client IP unavailable` / `503` | On Vercel set `WIDA_CLIENT_IP_HEADER=x-vercel-forwarded-for`, then redeploy. |
| `API not connected` / `503` | Set `WIDA_API_URL` for the intended deployment environment. |
| API returns `403` | Check identical proxy secrets; for writes, also check request Origin matches `WIDA_PUBLIC_ORIGIN`. |
| Google `redirect_uri_mismatch` | Match the exact frontend callback scheme, host and path in Google. |
| Google returns to the landing or callback reports unexpected redirect | Deploy current API and frontend together: the API must return `/workspace`, and the proxy must allow that destination. |
| Session returns `200` but `authenticated: false` after login | Inspect the callback's `Set-Cookie` and subsequent session request cookies in your browser without sharing their values; confirm stable API Data Protection keys and the same frontend domain throughout. |
| `/login` says service unavailable | Inspect the session request status; this is an availability/configuration failure, not the normal anonymous state. |

## Build and serve outside Vercel

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm start
```

See [development](development.md) for TypeScript checks and the webpack fallback on restricted build hosts.
