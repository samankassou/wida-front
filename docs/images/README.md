# Screenshot provenance

These images document Wida's interface using fictional suppliers, invoices, and amounts. They contain no customer documents or real extraction results. Keep the current application captures separate from the historical standalone concept when updating the docs.

## Current application

| File | Viewport and PNG dimensions | Source and state |
| --- | --- | --- |
| `workspace-inbox.png` | 1440 × 1400 px | Next.js application at `/`, demo mode with its initial eight-document workspace, light theme. |
| `workspace-review.png` | 1440 × 1400 px | Next.js application reviewing the initial Atelier North demo invoice before correction or saving. |
| `workspace-review-mobile.png` | 390 × 844 px | Same application review at a mobile viewport, with Invoice data selected. |

Captured on 8 September 2026 from the production Next.js server in demo mode. The desktop viewport was enlarged from 1440 × 1080 to 1440 × 1400 CSS pixels to include the content. Captures were not cropped or scaled; PNG dimensions match their capture viewports. The mobile capture used 390 × 844 CSS pixels.

These are application screenshots in demo mode, not evidence of live PostgreSQL/Azure integration. Reproduce them with `WIDA_API_URL` unset, a fresh browser profile or cleared demo storage, and the light theme. Open Atelier North for the review images.

## Historical concept

| File | PNG dimensions | Source and state |
| --- | --- | --- |
| `document-inbox.png` | 1264 × 695 px | Standalone concept, initial Documents view with five fictional documents. |
| `invoice-review.png` | 1264 × 883 px | Standalone concept, Atelier North review before correction. |
| `invoice-review-mobile.png` | 392 × 1477 px | Same review in the concept's narrow, vertically stacked layout. |

Captured on 8 September 2026 from [invoice-workspace.html](../prototypes/invoice-workspace.html). This prototype demonstrates local review interaction only. It resets on reload and does not call the API. Its layout and behavior differ from the current application.

Open the HTML file in a browser, leave it in its initial state for the inbox, then select **Atelier North** for review. Preserve the screenshot framing when replacing an image, and update the [UI guide](../ui-design.md) captions if the source or state changes.
