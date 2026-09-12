# Wida Frontend

Wida is an open-source document inbox and invoice review workspace built with Next.js, React, and TypeScript. Upload originals, compare extracted invoice details with their source, correct uncertain fields, and keep saved invoices together.

![Wida application document inbox with eight fictional demo documents.](docs/images/workspace-inbox.png)

*Current application in demo mode. The suppliers, invoices, and extraction results shown here are fictional.*

## What works

- Google sign-in for public beta users, personal document access, and sign-out in live mode.
- Document inbox with search, status tabs, actionable counts, supplier/date sorting, currency and upload-date filters, selection, and client-side pagination.
- Multiple-file upload with drag-and-drop or a file picker: up to 20 PDF, PNG, JPEG, or TIFF files at a time, each up to 4 MiB and at most two pages.
- Invoice review with original-document preview, confidence indicators, explicit checks for uncertain fields, extracted and editable line items, inline validation, and processing history.
- Invoice creation and editing, draft recovery, review-next navigation, and CSV export of saved invoice headers.
- Responsive navigation and review panels, light/dark preferences, and keyboard shortcuts: `/` to search, `U` to upload, and `?` for help.

![Wida application reviewing the fictional Atelier North invoice beside its source.](docs/images/workspace-review.png)

*Current application: the low-confidence invoice number needs a check against the source before saving.*

Screenshots refreshed on 12 September 2026. See the [mobile review capture](docs/images/workspace-review-mobile.png) and [capture context](docs/images/README.md).

See [development and verification](docs/development.md) for the browser checklist, storage behavior, and troubleshooting. The [current limits](#current-limits) distinguish implemented behavior from remaining work.

## Run the demo

Clone the [frontend repository](https://github.com/samankassou/wida-front) first. The [API repository](https://github.com/samankassou/wida-api) is separate and optional for the demo.

Use **Node.js 22.23.2 or newer supported 22.x, or Node.js 24+**, and **pnpm 12.3.4**. Node.js 22.23.2 is the baseline for the documented development and native TypeScript test commands.

From `wida-front`:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No environment file or backend is needed for demo mode. Leave `WIDA_API_URL` unset or empty; a value in `.env`, `.env.local`, or the process environment enables live mode. To use another port, run `pnpm dev --port 3001`.

The demo starts with eight fictional documents. Edits, saved invoices, and drafts use this browser origin's local storage; files you upload are kept in IndexedDB. New uploads have empty invoice fields for manual entry. Only the seeded examples demonstrate extraction: the demo does not send your files to an extraction service or invent results for them.

Browser data is local to that browser and origin. Clearing site data removes the demo records and uploaded originals. See [storage and reset](docs/development.md#storage-and-reset) before resetting a workspace.

## Connect the API

Configure and start the Wida API, including PostgreSQL, using its own README. From the backend repository, use the local HTTP launch profile:

```bash
dotnet run --project Wida.Api --launch-profile http
```

In `wida-front`, copy [.env.example](.env.example) to `.env.local` and set the **server-only** API origin, without an `/api` suffix:

```dotenv
WIDA_API_URL=http://localhost:5085
WIDA_PUBLIC_ORIGIN=http://localhost:3000
```

Restart the frontend server. The live workspace requires Google sign-in with a verified account. Configure the Google client credentials, the public beta setting, and `Authentication:PublicOrigin` in the API as described in its README. Register `http://localhost:3000/api/wida/auth/callback` as the Google OAuth redirect URI for local development. Credentials belong only in the backend's secrets; no Google client secret is configured in Next.js. If Google is not configured, Wida shows a configuration message and keeps document access protected.

`WIDA_PUBLIC_ORIGIN` is the public frontend origin and must equal the API's `Authentication:PublicOrigin`. It is required for live production and should use HTTPS on a shared deployment. For a different local frontend port, update these two values and the Google redirect URI together.

The workspace loads only the signed-in user's documents; it does not merge demo records into the backend. Automatic extraction additionally needs the API's Azure Document Intelligence configuration. Without Azure configuration, signed-in users can upload files and enter invoice details manually.

The browser calls the same-origin `/api/wida/...` route. Its Next.js server proxy forwards supported `GET`, `POST`, and `PUT` requests to the configured backend, including streaming uploads, original files, byte ranges, and Wida session cookies. The live workspace first requests `/api/wida/auth/session`; mutating requests include the returned `X-CSRF-TOKEN` and same-origin credentials. Authentication and ownership checks run in the API, including for originals and analysis history. Keep the API URL on the server; no `NEXT_PUBLIC_` variable is needed.

The proxy permits the controlled Google login/callback redirects and refuses redirects from ordinary data routes. For local development, use the HTTP launch profile above; for HTTPS, use an endpoint with a certificate trusted by the frontend's Node.js process. An unexpected redirect or untrusted certificate appears as an API connection error.

## Demo and live behavior

| Behavior | Demo | Live API |
| --- | --- | --- |
| Access | No account needed | Verified Google account |
| Starting data | Eight fictional documents | Latest 500 documents from the workspace endpoint |
| Original files | Generated sample illustrations; user uploads in IndexedDB | Backend file-content endpoint |
| Extraction | Seeded sample results; new uploads use manual entry | Explicit analysis request, optionally after upload |
| Saved invoices | Local storage | API `POST` or `PUT` |
| Unsaved drafts and field checks | Local storage | Session storage scoped to the signed-in user in the current tab |
| Theme preference | Local storage | Local storage |
| CSV export | Generated in the browser | Generated in the browser from loaded records |

Search, counts, filters, pagination, and exports operate on the loaded workspace. In live mode this is the latest 500 documents, not the full database. Export includes saved records matching the current filters across client pages, or the selected subset when a selection is active; line items are not included in the CSV.

## Drafts and extraction retries

Untouched forms use the latest extraction values, including after a failed run is retried successfully. Once you edit a form, Wida keeps that draft when extraction runs again. Review checkmarks belong to the extraction run that you checked: a new run clears those checkmarks while retaining your edited values. Saving successfully clears the draft and displays the saved invoice.

The API keeps a document `Saved` when invoice saving overlaps extraction, including when extraction fails or is cancelled. Processing history still reports each run's own result. Neither a saved status nor a field check is a formal approval or a server-side review audit trail.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start development mode. |
| `pnpm lint` | Run ESLint. |
| `pnpm test` | Run form/draft, auth/session, proxy, API-adapter, and workspace-state tests with Node's test runner. |
| `pnpm exec next typegen` | Generate Next.js route types. |
| `pnpm exec tsc --noEmit` | Check TypeScript after route types exist. |
| `pnpm build` | Create a production build with Turbopack. |
| `pnpm build --webpack` | Alternative production build when the host cannot run Turbopack. |
| `pnpm start` | Serve an existing production build. |

The test script runs `node --experimental-strip-types --test tests/*.test.mjs`. Linting is separate from the Next.js build. The layout uses system fonts and does not download Google Fonts during compilation.

## Project structure

```text
app/
  page.tsx                   Selects demo or live workspace
  login/page.tsx             Google login errors and session check
  layout.tsx                 Wida metadata and root layout
  globals.css                Workspace styles and theme tokens
  api/wida/[...path]/route.ts Server-side API proxy
components/
  auth-gate.tsx              Live session gate, login, and session expiry
  workspace.tsx              Inbox, navigation, document actions, and review coordination
  use-review-drafts.ts       Edited draft recovery, persistence, and storage failures
  upload-dialog.tsx          Multiple-file upload workflow
  invoice-review.tsx         Editable invoice, validation, and history
  document-preview.tsx       Sample, image, and native PDF previews
lib/                        API client, contracts, demo data, form helpers, storage
tests/                      Form/draft, auth, proxy, API-adapter, and workspace-state tests
docs/                       Development notes, deployment checklist, and screenshots
.env.example                Server-only API and public frontend origin examples
```

The UI uses native HTML controls, custom styles, and `lucide-react` icons. shadcn/ui is a design reference, not an installed dependency. The `@/*` import alias resolves from the repository root.

## Current limits

The API extracts eight header fields and line items from the first analyzed document. Extracted lines prefill the editable form; low or unknown confidence requires an explicit check before saving. Saved invoices and edited drafts retain their values. Live PDFs use the browser's PDF viewer. Field-to-source highlighting is demonstrated on sample invoices, but live extraction polygons are not drawn. Image and sample previews have custom zoom and rotation controls; PDF controls depend on the browser. TIFF preview support also depends on the browser.

Analysis uses a persistent backend queue. There is no approval/rejection workflow or server-persisted draft and field-review audit trail. **Extraction completed**, **checked in the form**, and **invoice saved** are separate events. Live PostgreSQL, Azure, and Google end-to-end validation must be performed in a configured environment; screenshots of the demo do not establish that integration result.

An expired session closes the live workspace and preserves drafts under their owner's id so the same account can recover them after signing in again. Explicit sign-out warns about unsaved drafts and removes that account's drafts from the current tab. Other open tabs close their workspace when the account changes or signs out, retaining only owner-scoped draft recovery data to avoid silently discarding their unsaved edits; session checks on focus provide a fallback. Draft recovery is browser-local and cannot protect unsaved changes if storage is unavailable.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, issue reports, and pull request expectations. See the [deployment checklist](docs/deployment.md) before publishing your own instance.

Update the docs when routes, environment settings, or behavior change. Run lint, the form tests, TypeScript checks, and a production build for application changes, then use the [browser checklist](docs/development.md#manual-browser-checklist) for affected workflows. Commit lockfile changes when dependencies change.

Coding agents should read [AGENTS.md](AGENTS.md) and the relevant version-specific guides in `node_modules/next/dist/docs/` before changing application code.

## Licence

This project is licensed under the [MIT Licence](LICENSE).

## Background analysis

Connected analysis requests return immediately with a queued run. The workspace polls known active analyses every three seconds (ten seconds after retrieval errors), restores their state after reload, and preserves invoice edits when results arrive. Queued/running documents cannot be submitted again from the review screen. Queue capacity is enforced by the API; upload remains saved when analysis admission fails. Initialize the API database before starting the application. See [queue operations](https://github.com/samankassou/wida-api/blob/main/docs/processing-queue.md).

## Public beta

`/demo` is always available without authentication, including when `WIDA_API_URL` is set. The connected workspace displays the lifetime page balance and accepts requests for additional credits. Ordinary users are limited to 2 pages/4 MiB per file; the API enforces quotas and administrator exemptions. See the [API public-beta guide](https://github.com/samankassou/wida-api/blob/main/docs/public-beta.md) for migrations and operator commands.

The workspace displays the authenticated profile. Administrators see “Sans quota Wida” and have no frontend upload quota or credit prompt. Authorization and exemptions are enforced by the API.
