# Development and verification

See the [frontend README](../README.md) for installation, demo mode, and live API setup. The application uses system fonts, so compilation does not require Google Fonts access.

## Automated checks

Run from `wida-front` with Node.js 22.23.2 or a supported newer version:

```bash
pnpm lint
pnpm test
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm build
```

The Node test runner exercises extraction-to-form mapping, confidence checks, missing values, date and amount validation, payload conversion, saved invoice initialization, API error mapping, workspace updates/navigation, session credentials, CSRF headers on every mutation, session expiry, and draft ownership isolation. It does not exercise a browser, Google, PostgreSQL, or Azure. Lint and type checks do not establish end-to-end behavior; use the checklist below for the workflow you change.

The default build uses Turbopack. If a restricted host rejects its child-process port binding, use `pnpm exec next build --webpack` as a build fallback. This fallback passed on the development host on 8 September 2026; the normal `pnpm build` script remains unchanged. The host-specific permission failure does not require changing the application or disabling sandbox protections.

## Verification results

Verified on 8 September 2026:

- All 19 frontend tests and 42 API tests passed; lint, TypeScript checks, and the webpack production build passed.
- The production frontend's demo workflow was checked for draft recovery after reload, invoice correction and saving, and manual line items.
- An uploaded PNG displayed correctly, including zoom and rotation. Mobile review at 390 px had no horizontal overflow, and theme switching worked.
- PostgreSQL and Azure were not exercised together in a live end-to-end run. The screenshots show the production frontend in demo mode.

## Manual browser checklist

Use a fresh browser profile or an expendable demo workspace for repeatable checks. Demo changes persist across reloads.

1. **Inbox:** confirm eight initial sample documents, then search by supplier and invoice number. Exercise status tabs, currency/date filters, sorting, no-results recovery, selection, and pagination after adding enough files.
2. **Review:** open Atelier North, compare `INV-2026-0187` with source `INV-2026-0137`, correct it, and explicitly mark it checked. Verify the confidence stays at 72% and another edit clears the check.
3. **Validation:** clear a required field, enter a due date before the invoice date, and change a total so it disagrees with subtotal plus tax. Saving should expose errors and focus the first problem. Restore valid values before continuing.
4. **Line items:** add a line, check quantity × unit price and line-total/subtotal mismatches, then correct them. Confirm saved lines reopen with the invoice.
5. **Drafts and saves:** edit a field, leave the document, return, and reload. Save a valid invoice, find it in Invoices, make a correction, and save changes without creating a second invoice.
6. **Upload:** choose or drop several supported files; exercise an empty, unsupported, and over-limit file. In demo mode, verify your original appears and its fields are blank for manual entry. Reload and check that the original and edits remain available.
7. **Export:** filter saved records and download CSV. Check that the export includes the filtered saved set across pages, or only its selected subset, and contains invoice headers without line items.
8. **Responsive and keyboard:** inspect desktop and a narrow mobile viewport. Switch Original document/Invoice data panels, navigate form tabs, operate dialogs with the keyboard, and try `/`, `U`, `?`, and Escape. Check both themes and visible focus.
9. **Originals:** exercise image zoom/rotation, a multi-page PDF's native controls, and the open-original fallback. Sample highlights do not imply live PDF polygon rendering.

For a configured live environment, also verify:

- Before sign-in, show the Google login page and confirm no workspace/original requests are made. A missing Google configuration must display a setup message and never allow anonymous document access.
- Sign in with an invited Google account. Verify name/email and sign-out, then try a non-invited account and a cancelled or failed Google callback.
- Open two different invited accounts in separate browser profiles. Each must see only its own documents; copied original, invoice, and processing URLs from the other profile must not reveal records.
- Edit an invoice, reload, and verify draft recovery. Expire the server session, then trigger a request: the workspace must close and the same account must recover its draft after signing in again. A different account must never load it.
- Sign out with unsaved changes and cancel the confirmation to keep working. Confirm sign-out on a second attempt and check that sensitive UI and the current account's live drafts are cleared. In another open tab, the old workspace must close too. Use browser Back and return focus to verify the session is checked again.
- Confirm upload, extraction, invoice creation/update, and sign-out carry `X-CSRF-TOKEN`; requests with a missing token or foreign Origin must be rejected by the server/proxy.
- Upload and preview a supported original, save a manually entered invoice, refresh, and update it through the API.
- Run extraction with valid Azure configuration, review its seven header fields, and confirm history and save behavior.
- Exercise missing/invalid extraction configuration, invalid invoice input, duplicate creation, and interrupted requests. A processing response with HTTP `201` may still have `status: "Failed"`.
- Reload after an interrupted analysis before retrying; the server may have persisted the run even when the browser did not receive its response.
- Confirm the workspace's 500-document load limit is understood when checking counts, filters, and exports.

These are verification instructions, not a claim that a live PostgreSQL/Azure run has been completed.

## Storage and reset

| Data | Storage |
| --- | --- |
| Demo documents and saved invoices | Local storage key `wida:demo:v2` |
| Demo drafts and field checks | Local storage keys beginning `wida:draft:v1:` |
| Live unsaved drafts and field checks | Session storage keys `wida:live-draft:v2:<user-id>:<document-id>` |
| Cross-tab authentication change notification | Local storage key `wida:auth-change:v1` containing an opaque user id and event metadata; no session or CSRF token |
| Demo uploaded originals | IndexedDB database `wida-local-files`, store `documents` |
| Light/dark preference | Local storage key `wida:theme:v1` |

To restore the initial demo, first retain anything you need, then clear the site's storage in browser developer tools and reload. This removes locally uploaded originals and demo edits. A different browser profile or origin starts with separate storage. Live saved records remain in the API; clearing browser storage affects unsaved live drafts, not those server records.

Drafts are browser recovery data, not a shared review log. Live drafts are scoped to both the signed-in user and browser tab; they do not provide cross-device continuation. Session expiry preserves stored drafts for the same user. Explicit sign-out clears that user's drafts after an unsaved-change warning. Old live draft keys without an owner are left untouched but never loaded into an authenticated workspace because they cannot safely be attributed to an account. They require explicit recovery or cleanup; demo drafts are unaffected. Storage failures display a warning; keep the page open until you have saved or retained the values you need.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Demo appears instead of live records | Set server-only `WIDA_API_URL` in `.env.local` and restart the frontend. |
| API connection error / proxy `502` | Confirm the API is listening at the configured origin. Use `http://localhost:5085` with `--launch-profile http`, or trusted HTTPS. Only approved authentication redirects pass through the proxy. |
| Google setup message or callback failure | Check the API's Google client credentials, invitation list, and `Authentication:PublicOrigin`; this must match `WIDA_PUBLIC_ORIGIN` and the registered Google callback URI. |
| Mutation rejected with `403` | Check the browser's Origin against `WIDA_PUBLIC_ORIGIN` and the session's `X-CSRF-TOKEN`. Reconnect if the account changed in another tab. |
| Extraction fails after upload | Inspect History and the API's Azure configuration. The stored original can still be reviewed and entered manually. |
| Source does not render | Open the original in a new tab. PDF/TIFF handling depends on the browser; unavailable files and invalid stored paths need backend investigation. |
| Older documents missing from search/export | The frontend loads the latest 500 documents; current filters do not query beyond them. |
| Draft appears after reopening | This is browser draft recovery. Saving removes the draft; clearing site/session storage removes unsaved browser data. |

Further browser checks confirmed invoice-number search, no-results recovery, USD filtering, selected-invoice CSV export feedback, and Next document navigation from Atelier North through Studio Fern to Northstar Logistics.

### Drafts and extraction retries

`useReviewDrafts` owns edited drafts and browser-storage failures. Untouched forms derive their values from the current workspace item, so retries cannot leave a cached empty form behind. Edited drafts retain their values; review checkmarks are associated with an extraction run and reset when that run changes. Legacy drafts without a run ID also require review again.

Verified in the demo browser on 2026-09-10: retry a failed extraction, edit a supplier, run extraction again, reload the page, and save the recovered draft. Automated form tests cover replacement extraction values and invalidation of checks on current, restored, and legacy drafts.
