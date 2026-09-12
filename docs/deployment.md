# Deploying the frontend

Wida is an open-source project under the [MIT License](../LICENSE). This guide distinguishes the browser demo from a connected instance. Hosting and third-party services are configured by the operator.

## Build and serve

Use the Node.js and pnpm versions documented in the [README](../README.md#run-the-demo). From the frontend repository:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm start
```

Use a host that runs the Next.js server. The current application uses server behavior, including locale cookies and, in connected mode, its API proxy; these instructions do not describe a static export.

## Browser demo

Leave `WIDA_API_URL` unset. Open the deployed application in a fresh browser and exercise the [browser checklist](development.md#manual-browser-checklist). Demo records persist locally in the visitor's browser; uploaded originals use IndexedDB. New uploads do not receive automatic extraction. The seeded extraction examples are fictional.

## Connected instance

Follow the [API deployment checklist](https://github.com/samankassou/wida-api/blob/main/docs/deployment.md) and [public-beta settings](https://github.com/samankassou/wida-api/blob/main/docs/public-beta.md). Configure `WIDA_API_URL`, `WIDA_PUBLIC_ORIGIN`, and `WIDA_CLIENT_IP_HEADER` using the [.env.example](../.env.example) descriptions. The ingress must overwrite the selected client-IP header, and the API must trust the actual Next.js connection address. The production proxy returns `503` if this configuration is missing or invalid.

Verify Google sign-in on the public HTTPS origin, then upload, analyze, correct, save, reload, and export with fictional documents. Check account isolation and session expiry. `/demo` remains public even when the API is connected.

## Public presentation

Check mobile and keyboard use, the page title/description, and the image and text shown when sharing the link. Review the generated page metadata and add sharing assets where needed; this checklist does not imply those assets are already implemented. Link visitors directly to `/demo` when an account should not be required.

Explain which behavior is simulated and which uses real extraction. For a portfolio, include the problem, your contribution, architecture decisions, known limits, screenshots, and links to the two source repositories. Do not claim measured accuracy, time savings, or live verification without evidence.
